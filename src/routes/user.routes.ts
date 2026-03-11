import { Router } from 'express';
import { UserController } from '../controllers/user.controller';
import { protect } from '../middlewares/auth.middleware';

const router = Router();
const userController = new UserController();

/**
 * @openapi
 * /users/me:
 *   get:
 *     summary: Retrieve current user profile
 *     tags: [Users]
 *     security:
 *       - bearerAuth: []
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
 */
router.put('/me', protect, userController.updateMe);

export default router;
