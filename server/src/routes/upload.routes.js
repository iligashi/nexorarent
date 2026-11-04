import { Router } from 'express';
import { authenticate } from '../middleware/auth.js';
import { requireAdmin, requireManager } from '../middleware/admin.js';
import { saveOptimizedImage, upload } from '../middleware/upload.js';

const router = Router();

// General image upload (blog, avatar, etc.)
router.post('/', authenticate, requireAdmin, requireManager, upload.single('image'), async (req, res, next) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'No file uploaded' });
    const image = await saveOptimizedImage(req.file.buffer);
    res.json({ url: image.url });
  } catch (err) { next(err); }
});

export default router;
