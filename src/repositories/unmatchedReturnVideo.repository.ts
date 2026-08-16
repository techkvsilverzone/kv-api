import { IUnmatchedReturnVideo } from '../domain/returns';
import { queryOne, queryRows } from '../infrastructure/postgres/pool';
import { toBigIntParam, toDate } from '../infrastructure/postgres/mapping';

export { IUnmatchedReturnVideo };

interface VideoRow {
  id: string;
  sender_phone: string;
  file_path: string;
  mime_type: string;
  caption: string | null;
  linked_return_id: string | null;
  received_at: Date | null;
  created_at: Date | null;
  updated_at: Date | null;
}

const mapVideo = (row: VideoRow): IUnmatchedReturnVideo => ({
  _id: String(row.id),
  senderPhone: row.sender_phone,
  filePath: row.file_path,
  mimeType: row.mime_type,
  caption: row.caption,
  linkedReturnId: row.linked_return_id === null ? null : String(row.linked_return_id),
  receivedAt: toDate(row.received_at),
  createdAt: toDate(row.created_at),
  updatedAt: toDate(row.updated_at),
});

const SELECT = `
  SELECT id, sender_phone, file_path, mime_type, caption, linked_return_id,
         received_at, created_at, updated_at
  FROM unmatched_return_videos`;

const RETURNING = `
  RETURNING id, sender_phone, file_path, mime_type, caption, linked_return_id,
            received_at, created_at, updated_at`;

export class UnmatchedReturnVideoRepository {
  public async create(data: {
    senderPhone: string;
    filePath: string;
    mimeType: string;
    caption?: string;
  }): Promise<IUnmatchedReturnVideo> {
    const row = await queryOne<VideoRow>(
      `INSERT INTO unmatched_return_videos (sender_phone, file_path, mime_type, caption, received_at)
       VALUES ($1, $2, $3, $4, NOW())
       ${RETURNING}`,
      [data.senderPhone, data.filePath, data.mimeType, data.caption ?? null],
    );

    return mapVideo(row!);
  }

  /** Unlinked videos only — once linked to a return they drop off the reconciliation queue. */
  public async findAllUnlinked(): Promise<IUnmatchedReturnVideo[]> {
    const rows = await queryRows<VideoRow>(
      `${SELECT} WHERE linked_return_id IS NULL ORDER BY received_at DESC, id DESC`,
    );
    return rows.map(mapVideo);
  }

  public async findById(id: string): Promise<IUnmatchedReturnVideo | null> {
    const videoId = toBigIntParam(id);
    if (!videoId) return null;

    const row = await queryOne<VideoRow>(`${SELECT} WHERE id = $1`, [videoId]);
    return row ? mapVideo(row) : null;
  }

  public async markLinked(id: string, returnId: string): Promise<IUnmatchedReturnVideo | null> {
    const videoId = toBigIntParam(id);
    const linkedId = toBigIntParam(returnId);
    if (!videoId || !linkedId) return null;

    const row = await queryOne<VideoRow>(
      `UPDATE unmatched_return_videos
       SET linked_return_id = $2, updated_at = NOW()
       WHERE id = $1
       ${RETURNING}`,
      [videoId, linkedId],
    );

    return row ? mapVideo(row) : null;
  }
}
