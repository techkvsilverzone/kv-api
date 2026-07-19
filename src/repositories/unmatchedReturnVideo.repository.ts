import mongoose from 'mongoose';
import { UnmatchedReturnVideo, IUnmatchedReturnVideo } from '../models/unmatchedReturnVideo.model';

export class UnmatchedReturnVideoRepository {
  public async create(data: {
    senderPhone: string;
    filePath: string;
    mimeType: string;
    caption?: string;
  }): Promise<IUnmatchedReturnVideo> {
    const video = new UnmatchedReturnVideo({ ...data, receivedAt: new Date() });
    return video.save();
  }

  /** Unlinked videos only — once linked to a return they drop off the reconciliation queue. */
  public async findAllUnlinked(): Promise<IUnmatchedReturnVideo[]> {
    return UnmatchedReturnVideo.find({ linkedReturnId: { $exists: false } })
      .sort({ receivedAt: -1 })
      .exec();
  }

  public async findById(id: string): Promise<IUnmatchedReturnVideo | null> {
    if (!mongoose.Types.ObjectId.isValid(id)) return null;
    return UnmatchedReturnVideo.findById(id).exec();
  }

  public async markLinked(id: string, returnId: string): Promise<IUnmatchedReturnVideo | null> {
    return UnmatchedReturnVideo.findByIdAndUpdate(
      id,
      { linkedReturnId: new mongoose.Types.ObjectId(returnId) },
      { new: true },
    ).exec();
  }
}
