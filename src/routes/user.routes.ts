import { Router } from 'express';
import { UserController } from '../controllers/user.controller';
import { IdProofController } from '../controllers/idProof.controller';
import { protect } from '../middlewares/auth.middleware';

const router = Router();
const userController = new UserController();
const idProofController = new IdProofController();

/**
 * @openapi
 * /users/me:
 *   get:
 *     summary: Retrieve current user profile
 *     tags: [Users]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: The current authenticated user's profile
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/User'
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       404:
 *         $ref: '#/components/responses/NotFound'
 */
router.get('/me', protect, userController.getMe);

/**
 * @openapi
 * /users/me:
 *   put:
 *     summary: Update current user profile
 *     tags: [Users]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       description: Partial user fields to update
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/User'
 *     responses:
 *       200:
 *         description: The updated user profile
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/User'
 *       400:
 *         $ref: '#/components/responses/BadRequest'
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       404:
 *         $ref: '#/components/responses/NotFound'
 */
router.put('/me', protect, userController.updateMe);

/**
 * @openapi
 * /users/me/addresses:
 *   get:
 *     summary: List the current user's saved addresses
 *     tags: [Users]
 *     security:
 *       - cookieAuth: []
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Saved addresses
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/Address'
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 */
router.get('/me/addresses', protect, userController.getAddresses);

/**
 * @openapi
 * /users/me/addresses:
 *   post:
 *     summary: Add a saved address
 *     tags: [Users]
 *     security:
 *       - cookieAuth: []
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/AddressInput'
 *     responses:
 *       201:
 *         description: Created address
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Address'
 *       400:
 *         $ref: '#/components/responses/BadRequest'
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 */
router.post('/me/addresses', protect, userController.addAddress);

/**
 * @openapi
 * /users/me/addresses/{id}:
 *   put:
 *     summary: Update a saved address
 *     tags: [Users]
 *     security:
 *       - cookieAuth: []
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/AddressInput'
 *     responses:
 *       200:
 *         description: Updated address
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Address'
 *       400:
 *         $ref: '#/components/responses/BadRequest'
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       404:
 *         $ref: '#/components/responses/NotFound'
 */
router.put('/me/addresses/:id', protect, userController.updateAddress);

/**
 * @openapi
 * /users/me/addresses/{id}:
 *   delete:
 *     summary: Delete a saved address
 *     tags: [Users]
 *     security:
 *       - cookieAuth: []
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       204:
 *         description: Address deleted
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       404:
 *         $ref: '#/components/responses/NotFound'
 */
router.delete('/me/addresses/:id', protect, userController.deleteAddress);

/**
 * @openapi
 * /users/{userId}/password:
 *   put:
 *     summary: Update user password (self or admin only)
 *     tags: [Users]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: userId
 *         required: true
 *         schema:
 *           type: string
 *         description: ID of the user whose password is being changed
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [newPassword]
 *             properties:
 *               newPassword:
 *                 type: string
 *                 format: password
 *     responses:
 *       200:
 *         description: Password updated successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/MessageResponse'
 *       400:
 *         $ref: '#/components/responses/BadRequest'
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       403:
 *         $ref: '#/components/responses/Forbidden'
 *       404:
 *         $ref: '#/components/responses/NotFound'
 */
router.put('/:userId/password', protect, userController.changePassword);

/**
 * @openapi
 * /users/me/phone/request-otp:
 *   post:
 *     summary: Request a WhatsApp/email code to verify the current user's phone number
 *     description: Item 1 — first-time mobile verification. Sends via WhatsApp when WHATSAPP_OTP_ENABLED is on, otherwise falls back to email so verification isn't blocked on Meta's Authentication-template approval.
 *     tags: [Users]
 *     security:
 *       - cookieAuth: []
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Code sent
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                 channel:
 *                   type: string
 *                   enum: [whatsapp, email]
 *       400:
 *         $ref: '#/components/responses/BadRequest'
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 */
router.post('/me/phone/request-otp', protect, userController.requestPhoneVerification);

/**
 * @openapi
 * /users/me/phone/verify-otp:
 *   post:
 *     summary: Verify the current user's phone number with the code from request-otp
 *     tags: [Users]
 *     security:
 *       - cookieAuth: []
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [code]
 *             properties:
 *               code:
 *                 type: string
 *     responses:
 *       200:
 *         description: Phone verified — returns the updated user
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 user:
 *                   $ref: '#/components/schemas/User'
 *       400:
 *         $ref: '#/components/responses/BadRequest'
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 */
router.post('/me/phone/verify-otp', protect, userController.verifyPhoneOtp);

/**
 * @openapi
 * /users/me/id-proof:
 *   get:
 *     summary: Get the current user's KYC ID proof submission (item 2), or null if none yet
 *     tags: [Users]
 *     security:
 *       - cookieAuth: []
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: The submission, or null
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 */
router.get('/me/id-proof', protect, idProofController.getMine);

/**
 * @openapi
 * /users/me/id-proof:
 *   post:
 *     summary: Submit (or resubmit) the current user's ID proof — required once before the first savings-scheme enrollment
 *     description: Verification is asynchronous — this call succeeds (status Pending) without waiting for admin/staff review, per business decision (non-blocking enrollment).
 *     tags: [Users]
 *     security:
 *       - cookieAuth: []
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [idProofType, idProofNumber, image]
 *             properties:
 *               idProofType:
 *                 type: string
 *                 enum: [AADHAAR, PAN, VOTER_ID, DRIVING_LICENSE]
 *               idProofNumber:
 *                 type: string
 *               image:
 *                 type: string
 *                 description: Base64 data URI of a photo of the document
 *     responses:
 *       201:
 *         description: Submission recorded, status Pending
 *       400:
 *         $ref: '#/components/responses/BadRequest'
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 */
router.post('/me/id-proof', protect, idProofController.submitMine);

export default router;
