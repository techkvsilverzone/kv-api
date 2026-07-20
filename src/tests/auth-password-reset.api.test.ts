import request from 'supertest';
import bcrypt from 'bcryptjs';
import app from '../app';
import { OtpService } from '../services/otp.service';
import { UserRepository } from '../repositories/user.repository';
import { OtpCodeRepository } from '../repositories/otpCode.repository';
import * as emailNotifications from '../utils/emailNotifications';

const user = {
  _id: { toString: () => 'u1' },
  name: 'Asha',
  email: 'asha@example.com',
};

describe('Password reset flow (POST /auth/forgot-password + /auth/reset-password)', () => {
  afterEach(() => jest.restoreAllMocks());

  describe('forgot-password', () => {
    it('emails a reset code and persists it under the password_reset purpose', async () => {
      jest.spyOn(UserRepository.prototype, 'findByEmail').mockResolvedValue(user as never);
      const create = jest
        .spyOn(OtpCodeRepository.prototype, 'create')
        .mockResolvedValue({} as never);
      const sendMail = jest
        .spyOn(emailNotifications, 'sendPasswordResetEmail')
        .mockResolvedValue(undefined);

      const res = await request(app)
        .post('/api/v1/auth/forgot-password')
        .send({ email: 'Asha@Example.com' });

      expect(res.status).toBe(200);
      expect(sendMail).toHaveBeenCalledTimes(1);

      // The code that goes out is the code that gets stored (hashed), under a
      // purpose distinct from login so the two flows can't cross-redeem.
      const [identifier, purpose, codeHash] = create.mock.calls[0];
      expect(identifier).toBe('asha@example.com');
      expect(purpose).toBe('password_reset');
      const emailed = sendMail.mock.calls[0][0].code;
      expect(emailed).toMatch(/^\d{6}$/);
      await expect(bcrypt.compare(emailed, codeHash)).resolves.toBe(true);
    });

    it('does not send mail or leak that an email is unregistered', async () => {
      jest.spyOn(UserRepository.prototype, 'findByEmail').mockResolvedValue(null as never);
      const sendMail = jest
        .spyOn(emailNotifications, 'sendPasswordResetEmail')
        .mockResolvedValue(undefined);

      const known = await request(app)
        .post('/api/v1/auth/forgot-password')
        .send({ email: 'nobody@example.com' });

      expect(known.status).toBe(200);
      expect(sendMail).not.toHaveBeenCalled();
      expect(known.body.message).toBe(
        'If that email is registered, a password reset code has been sent.',
      );
    });

    it('rejects a missing email', async () => {
      const res = await request(app).post('/api/v1/auth/forgot-password').send({});
      expect(res.status).toBe(400);
    });

    it('surfaces a mail dispatch failure rather than falsely claiming success', async () => {
      jest.spyOn(UserRepository.prototype, 'findByEmail').mockResolvedValue(user as never);
      jest.spyOn(OtpCodeRepository.prototype, 'create').mockResolvedValue({} as never);
      jest
        .spyOn(emailNotifications, 'sendPasswordResetEmail')
        .mockRejectedValue(new Error('smtp down'));

      const res = await request(app)
        .post('/api/v1/auth/forgot-password')
        .send({ email: 'asha@example.com' });

      expect(res.status).toBe(500);
    });
  });

  describe('reset-password', () => {
    const activeOtp = (codeHash: string) => ({ _id: { toString: () => 'otp1' }, codeHash });

    it('sets the new password and consumes the code', async () => {
      const codeHash = await bcrypt.hash('123456', 10);
      jest
        .spyOn(OtpCodeRepository.prototype, 'findActive')
        .mockResolvedValue(activeOtp(codeHash) as never);
      jest.spyOn(UserRepository.prototype, 'findByEmail').mockResolvedValue(user as never);
      const update = jest.spyOn(UserRepository.prototype, 'update').mockResolvedValue(user as never);
      const consume = jest
        .spyOn(OtpCodeRepository.prototype, 'markConsumed')
        .mockResolvedValue(undefined);

      const res = await request(app)
        .post('/api/v1/auth/reset-password')
        .send({ email: 'asha@example.com', code: '123456', newPassword: 'newsecret' });

      expect(res.status).toBe(200);
      expect(update).toHaveBeenCalledWith('u1', { password: 'newsecret' });
      expect(consume).toHaveBeenCalledWith('otp1');
    });

    it('counts a wrong code as an attempt and leaves the password alone', async () => {
      const codeHash = await bcrypt.hash('123456', 10);
      jest
        .spyOn(OtpCodeRepository.prototype, 'findActive')
        .mockResolvedValue(activeOtp(codeHash) as never);
      const update = jest.spyOn(UserRepository.prototype, 'update');
      const bump = jest
        .spyOn(OtpCodeRepository.prototype, 'incrementAttempts')
        .mockResolvedValue(undefined);

      const res = await request(app)
        .post('/api/v1/auth/reset-password')
        .send({ email: 'asha@example.com', code: '000000', newPassword: 'newsecret' });

      expect(res.status).toBe(400);
      expect(bump).toHaveBeenCalledWith('otp1');
      expect(update).not.toHaveBeenCalled();
    });

    it('rejects an expired or already-used code', async () => {
      jest.spyOn(OtpCodeRepository.prototype, 'findActive').mockResolvedValue(null as never);

      const res = await request(app)
        .post('/api/v1/auth/reset-password')
        .send({ email: 'asha@example.com', code: '123456', newPassword: 'newsecret' });

      expect(res.status).toBe(400);
      expect(res.body.message).toMatch(/expired/i);
    });

    it('rejects a too-short password before touching the code', async () => {
      const findActive = jest.spyOn(OtpCodeRepository.prototype, 'findActive');

      const res = await request(app)
        .post('/api/v1/auth/reset-password')
        .send({ email: 'asha@example.com', code: '123456', newPassword: 'short' });

      expect(res.status).toBe(400);
      expect(res.body.message).toMatch(/at least 6 characters/i);
      expect(findActive).not.toHaveBeenCalled();
    });

    it('will not redeem a login OTP as a reset code', async () => {
      const findActive = jest
        .spyOn(OtpCodeRepository.prototype, 'findActive')
        .mockResolvedValue(null as never);

      await request(app)
        .post('/api/v1/auth/reset-password')
        .send({ email: 'asha@example.com', code: '123456', newPassword: 'newsecret' });

      // Lookup is scoped to password_reset, so a stored login code is invisible here.
      expect(findActive).toHaveBeenCalledWith('asha@example.com', 'password_reset');
    });

    it('leaves the code unconsumed if the password write fails', async () => {
      const codeHash = await bcrypt.hash('123456', 10);
      jest
        .spyOn(OtpCodeRepository.prototype, 'findActive')
        .mockResolvedValue(activeOtp(codeHash) as never);
      jest.spyOn(UserRepository.prototype, 'findByEmail').mockResolvedValue(user as never);
      jest.spyOn(UserRepository.prototype, 'update').mockRejectedValue(new Error('mongo down'));
      const consume = jest.spyOn(OtpCodeRepository.prototype, 'markConsumed');

      const res = await request(app)
        .post('/api/v1/auth/reset-password')
        .send({ email: 'asha@example.com', code: '123456', newPassword: 'newsecret' });

      expect(res.status).toBe(500);
      expect(consume).not.toHaveBeenCalled();
    });
  });

  it('still issues login OTPs under the login purpose', async () => {
    jest.spyOn(UserRepository.prototype, 'findByEmail').mockResolvedValue(user as never);
    const create = jest.spyOn(OtpCodeRepository.prototype, 'create').mockResolvedValue({} as never);
    jest.spyOn(emailNotifications, 'sendOtpEmail').mockResolvedValue(undefined);

    await new OtpService().requestLoginOtp('asha@example.com');

    expect(create.mock.calls[0][1]).toBe('login');
  });
});
