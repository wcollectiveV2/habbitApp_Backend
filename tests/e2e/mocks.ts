// ============================================================================
// USER & AUTH MOCKS
// ============================================================================

export const mockUser = {
  id: '1',
  externalId: 'ext_1',
  email: 'test@example.com',
  name: 'Test User',
  avatar: 'https://i.pravatar.cc/150?u=1',
  avatarUrl: 'https://i.pravatar.cc/150?u=1',
  bio: 'Passionate about building healthy habits',
  streakCount: 7,
  totalPoints: 500,
  currentXp: 500,
  level: 6,
  privacyPublicLeaderboard: 'visible',
  privacyChallengeLeaderboard: 'visible',
  roles: ['user']
};

export const mockAdminUser = {
  ...mockUser,
  id: '2',
  email: 'admin@example.com',
  name: 'Admin User',
  roles: ['admin', 'user']
};

export const mockAuthResponse = {
  accessToken: 'fake_jwt_token',
  refreshToken: 'fake_refresh_token',
  user: mockUser
};

export const mockAdminAuthResponse = {
  accessToken: 'fake_admin_jwt_token',
  refreshToken: 'fake_admin_refresh_token',
  user: mockAdminUser
};

export const mockLoginError = {
  error: 'Invalid email or password',
  status: 401
};

export const mockRegistrationError = {
  error: 'Email already registered',
  status: 400
};

// ============================================================================
// TASK MOCKS
// ============================================================================

export const mockTasks = [
  {
    id: '1',
    title: 'Drink Water',
    description: 'Stay hydrated throughout the day',
    challengeName: 'Daily Habit',
    icon: 'local_drink',
    iconBg: 'bg-blue-100',
    iconColor: 'text-blue-600',
    status: 'pending',
    completed: false,
    currentProgress: 3,
    totalProgress: 8,
    currentValue: 3,
    goal: 8,
    progressBlocks: 4,
    activeBlocks: 1,
    priority: 'medium',
    type: 'counter',
    unit: 'glasses',
    dueDate: new Date().toISOString().split('T')[0]
  },
  {
    id: '2',
    title: 'Read Book',
    description: 'Read for 30 minutes',
    challengeName: 'Daily Habit',
    icon: 'menu_book',
    iconBg: 'bg-purple-100',
    iconColor: 'text-purple-600',
    status: 'completed',
    completed: true,
    currentProgress: 1,
    totalProgress: 1,
    currentValue: 1,
    goal: 1,
    progressBlocks: 4,
    activeBlocks: 4,
    priority: 'low',
    type: 'check'
  },
  {
    id: '3',
    title: 'Morning Exercise',
    description: '30 minutes workout',
    challengeName: 'Fitness',
    icon: 'fitness_center',
    iconBg: 'bg-green-100',
    iconColor: 'text-green-600',
    status: 'pending',
    completed: false,
    currentProgress: 0,
    totalProgress: 30,
    currentValue: 0,
    goal: 30,
    progressBlocks: 4,
    activeBlocks: 0,
    priority: 'high',
    type: 'counter',
    unit: 'minutes',
    dueDate: new Date().toISOString().split('T')[0]
  }
];

export const mockTasksWithPriorities = [
  {
    id: '1',
    title: 'High Priority Task',
    challengeName: 'Daily Habit',
    icon: 'priority_high',
    iconBg: 'bg-red-100',
    iconColor: 'text-red-600',
    status: 'pending',
    completed: false,
    currentProgress: 0,
    totalProgress: 7,
    progressBlocks: 4,
    activeBlocks: 0,
    priority: 'high',
    dueDate: new Date().toISOString().split('T')[0],
    type: 'check'
  },
  {
    id: '2',
    title: 'Medium Priority Task',
    challengeName: 'Weekly Goal',
    icon: 'fitness_center',
    iconBg: 'bg-yellow-100',
    iconColor: 'text-yellow-600',
    status: 'pending',
    completed: false,
    currentProgress: 3,
    totalProgress: 7,
    progressBlocks: 4,
    activeBlocks: 2,
    priority: 'medium',
    dueDate: new Date(Date.now() + 86400000).toISOString().split('T')[0],
    type: 'check'
  },
  {
    id: '3',
    title: 'Low Priority Task',
    challengeName: 'Optional',
    icon: 'local_drink',
    iconBg: 'bg-green-100',
    iconColor: 'text-green-600',
    status: 'completed',
    completed: true,
    currentProgress: 7,
    totalProgress: 7,
    progressBlocks: 4,
    activeBlocks: 4,
    priority: 'low',
    type: 'counter'
  }
];

export const mockEmptyTasks: any[] = [];

// ============================================================================
// CHALLENGE MOCKS
// ============================================================================

export const mockChallenges = [
  {
    id: 1,
    title: 'Morning Yoga Challenge',
    description: 'Start your day with 15 minutes of yoga',
    daily_action: 'Complete 15 minutes of yoga',
    daysRemaining: 12,
    progress: 45,
    participantCount: 156,
    type: 'individual',
    status: 'active',
    icon: 'self_improvement',
    isPublic: true,
    startDate: new Date(Date.now() - 9 * 86400000).toISOString(),
    endDate: new Date(Date.now() + 12 * 86400000).toISOString(),
    targetDays: 21,
    rewards: { xp: 500, badge: 'yoga_master' },
    active: true
  },
  {
    id: 2,
    title: 'No Sugar Week',
    description: 'Avoid added sugars for 7 days',
    daily_action: 'No added sugar today',
    daysRemaining: 5,
    progress: 80,
    participantCount: 89,
    type: 'individual',
    status: 'active',
    icon: 'no_food',
    isPublic: true,
    startDate: new Date(Date.now() - 2 * 86400000).toISOString(),
    endDate: new Date(Date.now() + 5 * 86400000).toISOString(),
    targetDays: 7,
    rewards: { xp: 200 },
    active: true
  }
];

export const mockDiscoverChallenges = {
  challenges: [
    {
      id: 3,
      title: 'Marathon Training',
      description: 'Run 42km in 4 weeks',
      daily_action: 'Complete your daily run',
      participantCount: 500,
      daysRemaining: 28,
      type: 'competitive',
      status: 'active',
      icon: 'directions_run',
      isJoined: false
    },
    {
      id: 4,
      title: 'Meditation Master',
      description: 'Meditate daily for 30 days',
      daily_action: 'Meditate for 10 minutes',
      participantCount: 200,
      daysRemaining: 15,
      type: 'individual',
      status: 'active',
      icon: 'self_improvement',
      isJoined: false
    },
    {
      id: 5,
      title: 'Fitness Squad',
      description: 'Group workout challenge',
      daily_action: 'Complete group workout',
      participantCount: 50,
      daysRemaining: 20,
      type: 'group',
      status: 'active',
      icon: 'fitness_center',
      isJoined: false
    }
  ]
};

export const mockChallengeDetail = {
  id: 1,
  title: 'Morning Yoga Challenge',
  description: 'Start your day with 15 minutes of yoga to improve flexibility and mindfulness',
  daily_action: 'Complete 15 minutes of yoga',
  type: 'individual',
  status: 'active',
  icon: 'self_improvement',
  isPublic: true,
  startDate: new Date(Date.now() - 9 * 86400000).toISOString(),
  endDate: new Date(Date.now() + 12 * 86400000).toISOString(),
  targetDays: 21,
  participantCount: 156,
  rewards: { xp: 500, badge: 'yoga_master' },
  userProgress: {
    progress: 45,
    completed_days: 9,
    current_streak: 5,
    joined_at: new Date(Date.now() - 9 * 86400000).toISOString()
  }
};

export const mockChallengeLeaderboard = [
  {
    rank: 1,
    userId: '10',
    name: 'Sarah Johnson',
    avatarUrl: 'https://i.pravatar.cc/150?u=10',
    points: 950,
    progress: 95
  },
  {
    rank: 2,
    userId: '11',
    name: 'Mike Chen',
    avatarUrl: 'https://i.pravatar.cc/150?u=11',
    points: 880,
    progress: 88
  },
  {
    rank: 3,
    userId: '12',
    name: 'Emma Wilson',
    avatarUrl: 'https://i.pravatar.cc/150?u=12',
    points: 820,
    progress: 82
  },
  {
    rank: 4,
    userId: '1', // Current user
    name: 'Test User',
    avatarUrl: 'https://i.pravatar.cc/150?u=1',
    points: 450,
    progress: 45
  },
  {
    rank: 5,
    userId: '13',
    name: 'Anonymous User',
    avatarUrl: null,
    points: 400,
    progress: 40
  }
];

// ============================================================================
// SOCIAL MOCKS
// ============================================================================

export const mockLeaderboard = [
  {
    rank: 1,
    userId: '20',
    name: 'Alex Champion',
    avatarUrl: 'https://i.pravatar.cc/150?u=20',
    points: 5200,
    streak: 45
  },
  {
    rank: 2,
    userId: '21',
    name: 'Jordan Silver',
    avatarUrl: 'https://i.pravatar.cc/150?u=21',
    points: 4800,
    streak: 38
  },
  {
    rank: 3,
    userId: '22',
    name: 'Taylor Bronze',
    avatarUrl: 'https://i.pravatar.cc/150?u=22',
    points: 4500,
    streak: 32
  },
  {
    rank: 4,
    userId: '1', // Current user
    name: 'Test User',
    avatarUrl: 'https://i.pravatar.cc/150?u=1',
    points: 500,
    streak: 7
  },
  {
    rank: 5,
    userId: '23',
    name: 'Casey Climber',
    avatarUrl: 'https://i.pravatar.cc/150?u=23',
    points: 480,
    streak: 5
  }
];

export const mockFriendsLeaderboard = [
  {
    rank: 1,
    userId: '30',
    name: 'Friend One',
    avatarUrl: 'https://i.pravatar.cc/150?u=30',
    points: 600,
    streak: 10
  },
  {
    rank: 2,
    userId: '1',
    name: 'Test User',
    avatarUrl: 'https://i.pravatar.cc/150?u=1',
    points: 500,
    streak: 7
  },
  {
    rank: 3,
    userId: '31',
    name: 'Friend Two',
    avatarUrl: 'https://i.pravatar.cc/150?u=31',
    points: 350,
    streak: 3
  }
];

export const mockActivityFeed = [
  {
    id: '1',
    userId: '20',
    userName: 'Alex Champion',
    userAvatar: 'https://i.pravatar.cc/150?u=20',
    type: 'challenge_joined',
    action: 'joined',
    target: 'Morning Yoga Challenge',
    timestamp: new Date(Date.now() - 5 * 60000).toISOString() // 5m ago
  },
  {
    id: '2',
    userId: '21',
    userName: 'Jordan Silver',
    userAvatar: 'https://i.pravatar.cc/150?u=21',
    type: 'streak_milestone',
    action: 'reached',
    target: '30-day streak',
    timestamp: new Date(Date.now() - 2 * 3600000).toISOString() // 2h ago
  },
  {
    id: '3',
    userId: '22',
    userName: 'Taylor Bronze',
    userAvatar: 'https://i.pravatar.cc/150?u=22',
    type: 'challenge_completed',
    action: 'completed',
    target: 'No Sugar Week',
    timestamp: new Date(Date.now() - 24 * 3600000).toISOString() // 1d ago
  },
  {
    id: '4',
    userId: '23',
    userName: 'Casey Climber',
    userAvatar: 'https://i.pravatar.cc/150?u=23',
    type: 'level_up',
    action: 'reached',
    target: 'Level 10',
    timestamp: new Date(Date.now() - 3 * 24 * 3600000).toISOString() // 3d ago
  }
];

// ============================================================================
// USER STATS & ACTIVITY MOCKS
// ============================================================================

export const mockUserStats = {
  streakCount: 7,
  totalPoints: 500,
  currentXp: 500,
  level: 6,
  completedTasks: 45,
  completedChallenges: 3,
  totalRewards: 100,
  badges: ['early_bird', 'first_challenge']
};

export const mockWeeklyActivity = [
  { date: new Date(Date.now() - 6 * 86400000).toISOString(), completed: true },
  { date: new Date(Date.now() - 5 * 86400000).toISOString(), completed: true },
  { date: new Date(Date.now() - 4 * 86400000).toISOString(), completed: false },
  { date: new Date(Date.now() - 3 * 86400000).toISOString(), completed: true },
  { date: new Date(Date.now() - 2 * 86400000).toISOString(), completed: true },
  { date: new Date(Date.now() - 1 * 86400000).toISOString(), completed: true },
  { date: new Date().toISOString(), completed: false } // Today
];

// ============================================================================
// AI COACH MOCKS
// ============================================================================

export const mockAiDailyTip = {
  tip: 'Start your day with a glass of water to boost your metabolism!',
  category: 'motivation'
};

export const mockAiChatResponses = [
  "I'm currently undergoing maintenance to serve you better! Try again soon.",
  "My AI systems are getting an upgrade. In the meantime, stay focused on your goals!",
  "I can't process complex queries just yet, but keep building those habits!",
  "Feature coming soon! Our team is hard at work improving my capabilities."
];

// ============================================================================
// NOTIFICATION MOCKS
// ============================================================================

export const mockNotifications = [
  {
    id: '1',
    type: 'challenge_invite',
    title: 'Challenge Invitation',
    message: 'Alex invited you to join "30-Day Fitness"',
    data: { challengeId: 5 },
    isRead: false,
    createdAt: new Date(Date.now() - 30 * 60000).toISOString()
  },
  {
    id: '2',
    type: 'friend_request',
    title: 'Friend Request',
    message: 'Jordan wants to be your friend',
    data: { userId: '21' },
    isRead: false,
    createdAt: new Date(Date.now() - 2 * 3600000).toISOString()
  },
  {
    id: '3',
    type: 'achievement',
    title: 'Achievement Unlocked!',
    message: 'You earned the "Early Bird" badge',
    data: { badge: 'early_bird' },
    isRead: true,
    createdAt: new Date(Date.now() - 24 * 3600000).toISOString()
  }
];

// ============================================================================
// ADMIN MOCKS
// ============================================================================

export const mockAdminStats = {
  totalUsers: 1250,
  activeProtocols: 15,
  ordersToday: 0
};

export const mockAdminUsers = [
  {
    id: '1',
    email: 'test@example.com',
    name: 'Test User',
    roles: ['user'],
    groups: ['Health Org'],
    createdAt: new Date(Date.now() - 30 * 86400000).toISOString()
  },
  {
    id: '2',
    email: 'admin@example.com',
    name: 'Admin User',
    roles: ['admin', 'user'],
    groups: [],
    createdAt: new Date(Date.now() - 60 * 86400000).toISOString()
  },
  {
    id: '3',
    email: 'coach@example.com',
    name: 'Coach User',
    roles: ['coach', 'user'],
    groups: ['Fitness Org'],
    createdAt: new Date(Date.now() - 15 * 86400000).toISOString()
  }
];

export const mockOrganizations = [
  {
    id: 1,
    name: 'Health Org',
    logo_url: 'https://example.com/health-logo.png',
    createdAt: new Date(Date.now() - 90 * 86400000).toISOString()
  },
  {
    id: 2,
    name: 'Fitness Org',
    logo_url: 'https://example.com/fitness-logo.png',
    createdAt: new Date(Date.now() - 60 * 86400000).toISOString()
  }
];

export const mockProtocols = [
  {
    id: '1',
    name: '30-Day Fitness Protocol',
    description: 'Complete fitness transformation program',
    creatorId: '2',
    isPublic: true,
    elements: [
      { id: '1', title: 'Morning Workout', type: 'check', frequency: 'daily' },
      { id: '2', title: 'Water Intake', type: 'number', frequency: 'daily', goal: 8, unit: 'glasses' }
    ]
  },
  {
    id: '2',
    name: 'Mindfulness Program',
    description: 'Daily meditation and reflection',
    creatorId: '2',
    isPublic: true,
    elements: [
      { id: '3', title: 'Meditation', type: 'timer', frequency: 'daily', goal: 10, unit: 'minutes' }
    ]
  }
];

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

export function getCompletionPercentage(tasks: typeof mockTasks) {
  if (tasks.length === 0) return 0;
  const completed = tasks.filter(t => t.completed || t.status === 'completed').length;
  return Math.round((completed / tasks.length) * 100);
}
