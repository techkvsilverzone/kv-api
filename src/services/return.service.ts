import fs from 'fs';
import { ReturnRepository } from '../repositories/return.repository';
import { OrderRepository } from '../repositories/order.repository';
import { UnmatchedReturnVideoRepository } from '../repositories/unmatchedReturnVideo.repository';
import { downloadAndStoreWhatsAppMedia } from '../utils/whatsappMedia';
import { config } from '../config';
import { AppError } from '../utils/appError';
import Logger from '../utils/logger';

export class ReturnService {
  private returnRepository: ReturnRepository;
  private orderRepository: OrderRepository;
  private unmatchedVideoRepository: UnmatchedReturnVideoRepository;

  constructor() {
    this.returnRepository = new ReturnRepository();
    this.orderRepository = new OrderRepository();
    this.unmatchedVideoRepository = new UnmatchedReturnVideoRepository();
  }

  public async createReturn(userId: string, data: any) {
    const faultType = data.faultType === 'customer_preference' ? 'customer_preference' : 'kv_fault';
    if (data.faultType !== 'kv_fault' && data.faultType !== 'customer_preference') {
      throw new AppError('faultType must be "kv_fault" or "customer_preference"', 400);
    }
    if (!data.reason || !String(data.reason).trim()) {
      throw new AppError('reason is required', 400);
    }

    const order = await this.orderRepository.findById(String(data.orderId));
    if (!order) throw new AppError('Order not found', 404);
    // findById populates userId ('name email'), so it's a doc with `_id`, not a bare ObjectId.
    const orderUserId = (order.userId as unknown as { _id?: unknown })?._id ?? order.userId;
    if (String(orderUserId) !== userId) {
      throw new AppError('Not authorized', 403);
    }
    if (order.status !== 'Delivered' || !order.deliveredAt) {
      throw new AppError('Only delivered orders can be returned', 400);
    }

    const hoursSinceDelivery = (Date.now() - new Date(order.deliveredAt).getTime()) / (60 * 60 * 1000);
    if (hoursSinceDelivery > config.returnClaimWindowHours) {
      throw new AppError(
        `The return window has closed — claims must be filed within ${config.returnClaimWindowHours} hours of delivery.`,
        400,
      );
    }

    const created = await this.returnRepository.create({ ...data, userId, faultType });

    return {
      ...created,
      // Only meaningful for kv_fault claims, but harmless to always include.
      videoInstructions:
        created.videoStatus === 'awaiting'
          ? {
              whatsappNumber: config.returnVideoWhatsappNumber,
              referenceCode: created.videoReferenceCode,
              windowHours: config.returnClaimWindowHours,
            }
          : null,
    };
  }

  public async getMyReturns(userId: string) {
    return await this.returnRepository.findByUserId(userId);
  }

  public async getAllReturns() {
    return await this.returnRepository.findAll();
  }

  public async updateReturnStatus(id: string, status: string, refundAmount: number) {
    const updated = await this.returnRepository.updateStatus(id, status, refundAmount);
    if (!updated) throw new AppError('Return request not found', 404);
    return updated;
  }

  // ── Return video (WhatsApp) ──────────────────────────────────────────

  /** Public policy info the frontend needs to render the "send us a video" instructions. */
  public getReturnPolicy() {
    return {
      whatsappNumber: config.returnVideoWhatsappNumber,
      claimWindowHours: config.returnClaimWindowHours,
    };
  }

  /**
   * Called by the WhatsApp webhook for each inbound video/document message.
   * Matches to a return by (1) a "RET-XXXXXX" code in the caption, else (2) the
   * sender's phone against returns awaiting video whose ORDER ships to that
   * phone — only when exactly one candidate exists. Anything else is stored
   * unmatched for manual admin reconciliation.
   */
  public async handleIncomingWhatsAppMedia(input: {
    from: string;
    mediaId: string;
    caption?: string;
  }): Promise<void> {
    const codeMatch = (input.caption || '').match(/RET-[A-Z0-9]{6}/i);

    let matchedReturnId: string | null = null;
    if (codeMatch) {
      const byCode = await this.returnRepository.findByVideoReferenceCode(codeMatch[0]);
      if (byCode && byCode.videoStatus === 'awaiting') {
        matchedReturnId = byCode._id.toString();
      }
    }

    if (!matchedReturnId) {
      const byPhone = await this.returnRepository.findAwaitingVideoByPhone(input.from);
      if (byPhone.length === 1) {
        matchedReturnId = byPhone[0]._id.toString();
      }
    }

    const filenameHint = matchedReturnId ? `return-${matchedReturnId}` : `unmatched-${input.from}`;

    try {
      const { filePath, mimeType } = await downloadAndStoreWhatsAppMedia(input.mediaId, filenameHint);

      if (matchedReturnId) {
        await this.returnRepository.attachVideo(matchedReturnId, { filePath, mimeType, senderPhone: input.from });
        Logger.info(`[return-video] matched incoming video to return ${matchedReturnId}`);
      } else {
        await this.unmatchedVideoRepository.create({
          senderPhone: input.from,
          filePath,
          mimeType,
          caption: input.caption,
        });
        Logger.warn(`[return-video] could not auto-match video from ${input.from} — stored as unmatched`);
      }
    } catch (error) {
      Logger.error(`[return-video] failed to process incoming media: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  // ── Admin: video review ──────────────────────────────────────────────

  public async getReturnVideoFile(returnId: string): Promise<{ filePath: string; mimeType: string }> {
    const ret = await this.returnRepository.findById(returnId);
    if (!ret || ret.videoStatus !== 'received' || !ret.videoFilePath) {
      throw new AppError('No video available for this return', 404);
    }
    if (!fs.existsSync(ret.videoFilePath)) {
      throw new AppError('Video file is missing on disk', 404);
    }
    return { filePath: ret.videoFilePath, mimeType: ret.videoMimeType || 'video/mp4' };
  }

  public async getUnmatchedVideos() {
    return await this.unmatchedVideoRepository.findAllUnlinked();
  }

  public async getUnmatchedVideoFile(id: string): Promise<{ filePath: string; mimeType: string }> {
    const video = await this.unmatchedVideoRepository.findById(id);
    if (!video || !fs.existsSync(video.filePath)) {
      throw new AppError('Video not found', 404);
    }
    return { filePath: video.filePath, mimeType: video.mimeType };
  }

  public async linkUnmatchedVideo(unmatchedVideoId: string, returnId: string) {
    const video = await this.unmatchedVideoRepository.findById(unmatchedVideoId);
    if (!video) throw new AppError('Unmatched video not found', 404);

    const ret = await this.returnRepository.attachVideo(returnId, {
      filePath: video.filePath,
      mimeType: video.mimeType,
      senderPhone: video.senderPhone,
    });
    if (!ret) throw new AppError('Return request not found', 404);

    await this.unmatchedVideoRepository.markLinked(unmatchedVideoId, returnId);
    return ret;
  }
}
