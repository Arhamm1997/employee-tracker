import { Router } from "express";
import { authenticate } from "../middleware/auth.middleware";
import {
  getConversations,
  getConversation,
  sendMessage,
  replyMessage,
  markConversationRead,
} from "../controllers/message.controller";

const router = Router();

router.use(authenticate);

router.get("/conversations", getConversations);
router.get("/:conversationId", getConversation);
router.put("/:conversationId/read", markConversationRead);
router.post("/:conversationId/reply", replyMessage);
router.post("/", sendMessage);

export default router;
