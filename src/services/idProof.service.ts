import { IdProofRepository } from '../repositories/idProof.repository';
import { persistImage } from '../infrastructure/storage/productImages';
import { AppError } from '../utils/appError';
import { IUserIdProof, IdProofType, IdProofVerificationStatus } from '../domain/idProof';

const ID_PROOF_TYPES: IdProofType[] = ['AADHAAR', 'PAN', 'VOTER_ID', 'DRIVING_LICENSE'];

const NUMBER_PATTERNS: Partial<Record<IdProofType, RegExp>> = {
  AADHAAR: /^\d{12}$/,
  PAN: /^[A-Z]{5}\d{4}[A-Z]$/,
};

export class IdProofService {
  private idProofRepository: IdProofRepository;

  constructor() {
    this.idProofRepository = new IdProofRepository();
  }

  /** Item 2: submit (or resubmit, e.g. after a rejection) the calling user's own ID proof. */
  public async submit(
    userId: string,
    data: { idProofType?: string; idProofNumber?: string; image?: string },
  ): Promise<IUserIdProof> {
    const idProofType = String(data.idProofType || '').toUpperCase().trim() as IdProofType;
    if (!ID_PROOF_TYPES.includes(idProofType)) {
      throw new AppError(`idProofType must be one of ${ID_PROOF_TYPES.join(', ')}`, 400);
    }

    const idProofNumber = String(data.idProofNumber || '').toUpperCase().trim();
    if (!idProofNumber) {
      throw new AppError('idProofNumber is required', 400);
    }
    const pattern = NUMBER_PATTERNS[idProofType];
    if (pattern && !pattern.test(idProofNumber)) {
      throw new AppError(`idProofNumber is not a valid ${idProofType}`, 400);
    }

    if (!data.image) {
      throw new AppError('A photo of the document is required', 400);
    }
    const imageUrl = await persistImage(`id-proofs/${userId}`, 0, data.image);
    if (!imageUrl) {
      throw new AppError('Could not read the uploaded document photo — please try a different file', 400);
    }

    return this.idProofRepository.submit(userId, { idProofType, idProofNumber, imageUrl });
  }

  public async getMine(userId: string): Promise<IUserIdProof | null> {
    return this.idProofRepository.findByUserId(userId);
  }

  public async listForAdmin(status?: string): Promise<IUserIdProof[]> {
    const normalized = status ? (String(status) as IdProofVerificationStatus) : undefined;
    return this.idProofRepository.findAll(normalized);
  }

  public async verify(
    id: string,
    verifiedBy: string,
    data: { status?: string; rejectionReason?: string },
  ): Promise<IUserIdProof> {
    const status = String(data.status || '');
    if (status !== 'Verified' && status !== 'Rejected') {
      throw new AppError("status must be 'Verified' or 'Rejected'", 400);
    }
    if (status === 'Rejected' && !data.rejectionReason?.trim()) {
      throw new AppError('rejectionReason is required when rejecting', 400);
    }

    const updated = await this.idProofRepository.verify(id, {
      status,
      verifiedBy,
      rejectionReason: data.rejectionReason,
    });
    if (!updated) throw new AppError('ID proof submission not found', 404);
    return updated;
  }
}
