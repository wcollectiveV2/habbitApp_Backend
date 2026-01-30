import type { VercelRequest, VercelResponse } from '@vercel/node';
import { json, error, cors } from '../lib/response';
import { getAuthFromRequest } from '../lib/auth';
import { query } from '../lib/db';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Handle CORS preflight
  cors(res, req);
  
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  const auth = getAuthFromRequest(req);
  if (!auth) {
    return error(res, 'Unauthorized', 401, req);
  }

  const userId = auth.sub;
  const path = req.url?.split('?')[0] || '';

  // GET /api/ai/daily-tip
  if (req.method === 'GET' && path.includes('/daily-tip')) {
    return getDailyTip(userId, res, req);
  }

  // POST /api/ai/coach/chat
  if (req.method === 'POST' && path.includes('/coach/chat')) {
    return chat(userId, req, res);
  }

  // GET /api/ai/coach/history
  if (req.method === 'GET' && path.includes('/coach/history')) {
    return getChatHistory(userId, req, res);
  }

  // GET /api/ai/coach/conversations
  if (req.method === 'GET' && path.includes('/coach/conversations')) {
    return getConversations(userId, res, req);
  }

  return error(res, 'Not found', 404, req);
}

async function getDailyTip(userId: string, res: VercelResponse, req: VercelRequest) {
  try {
    // Generate a daily tip based on user's habits and progress
    const tips = [
      {
        id: 1,
        content: "Great progress this week! Remember, consistency beats perfection. Even on tough days, showing up matters most.",
        category: 'motivation' as const,
      },
      {
        id: 2,
        content: "Try stacking a new habit with an existing one. For example, do 5 minutes of stretching right after brushing your teeth.",
        category: 'suggestion' as const,
      },
      {
        id: 3,
        content: "Your morning routine sets the tone for your day. Consider starting with your most important habit first.",
        category: 'insight' as const,
      },
      {
        id: 4,
        content: "Don't forget to celebrate small wins! Each completed habit is a step toward your goals.",
        category: 'motivation' as const,
      },
      {
        id: 5,
        content: "Hydration impacts energy levels significantly. Try linking water intake to your existing habits.",
        category: 'suggestion' as const,
      },
      {
        id: 6,
        content: "Your streak is building momentum! Research shows it takes about 66 days to form a lasting habit.",
        category: 'insight' as const,
      },
      {
        id: 7,
        content: "Consider setting a specific time for your habits. Time-based cues are powerful triggers.",
        category: 'reminder' as const,
      }
    ];

    // Use date to get consistent tip for the day
    const dayOfYear = Math.floor((Date.now() - new Date(new Date().getFullYear(), 0, 0).getTime()) / (1000 * 60 * 60 * 24));
    const tipIndex = dayOfYear % tips.length;
    const tip = tips[tipIndex];

    return json(res, {
      id: tip.id,
      userId: userId,
      content: tip.content,
      category: tip.category,
      date: new Date().toISOString().split('T')[0],
      createdAt: new Date().toISOString()
    }, 200, req);
  } catch (err: any) {
    return error(res, err.message || 'Failed to get daily tip', 500, req);
  }
}

async function chat(userId: string, req: VercelRequest, res: VercelResponse) {
  try {
    const { message, conversationId } = req.body;

    if (!message) {
      return error(res, 'Message is required', 400, req);
    }

    // Generate AI-like response based on the message
    const responses = [
      "That's a great question! Building habits is all about consistency. Start small and gradually increase the difficulty.",
      "I understand how challenging it can be to stay motivated. Remember, progress isn't always linear. Every step forward counts!",
      "Have you tried breaking down your goal into smaller, more manageable tasks? This can make the journey feel less overwhelming.",
      "Excellent work on staying committed! Your dedication is inspiring. Keep up the great momentum!",
      "Consider pairing your new habit with something you already enjoy. This positive association can help reinforce the behavior.",
      "Rest days are important too! Recovery is part of the process, not a setback.",
      "Try visualizing your success. Mental rehearsal can be a powerful tool for building new habits.",
    ];

    const responseIndex = Math.floor(Math.random() * responses.length);
    const newConversationId = conversationId || Date.now();

    const aiMessage = {
      id: Date.now(),
      conversationId: newConversationId,
      role: 'assistant' as const,
      content: responses[responseIndex],
      metadata: {
        sentiment: 'positive' as const,
        suggestedActions: ['Track your progress', 'Set a reminder', 'Share with friends']
      },
      createdAt: new Date().toISOString()
    };

    return json(res, {
      message: aiMessage,
      conversationId: newConversationId
    }, 200, req);
  } catch (err: any) {
    return error(res, err.message || 'Failed to process chat', 500, req);
  }
}

async function getChatHistory(userId: string, req: VercelRequest, res: VercelResponse) {
  try {
    const { conversationId, limit = '50', before } = req.query;

    // Return empty history since we don't persist chat messages yet
    return json(res, {
      messages: [],
      hasMore: false
    }, 200, req);
  } catch (err: any) {
    return error(res, err.message || 'Failed to get chat history', 500, req);
  }
}

async function getConversations(userId: string, res: VercelResponse, req: VercelRequest) {
  try {
    // Return empty conversations since we don't persist yet
    return json(res, [], 200, req);
  } catch (err: any) {
    return error(res, err.message || 'Failed to get conversations', 500, req);
  }
}
