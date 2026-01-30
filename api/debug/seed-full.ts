
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { neon } from '@neondatabase/serverless';
import { hash } from 'bcryptjs';
import { cors } from '../../lib/response';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  cors(res, req);
  if (req.method === 'OPTIONS') return res.status(200).end();

  try {
    const dbUrl = process.env.DATABASE_URL || process.env.WCLTV_POSTGRES_URL;
    if (!dbUrl) throw new Error('Missing Database URL');
    
    const sql = neon(dbUrl);
    
    // 1. Clean up existing data
    console.log('Cleaning database...');
    // Note: 'protocols' and 'protocol_elements' depend on each other. 'user_protocols' too.
    await sql`TRUNCATE users, organizations, habits, challenges, tasks, notifications, protocols, protocol_elements, user_protocols, habit_logs, organization_members CASCADE`;

    // 2. Create Users
    console.log('Creating users...');
    const passwordHash = await hash('password123', 10);
    
    // Admin User
    const [admin] = await sql`
      INSERT INTO users (email, password_hash, name, bio, roles)
      VALUES ('admin@habitpulse.com', ${passwordHash}, 'Admin User', 'System Administrator', ARRAY['admin', 'user'])
      RETURNING id
    `;

    // Coach User
    const [coach] = await sql`
      INSERT INTO users (email, password_hash, name, bio, roles)
      VALUES ('coach@habitpulse.com', ${passwordHash}, 'Coach Mike', 'Certified Habit Coach', ARRAY['coach', 'user'])
      RETURNING id
    `;

    // Regular User
    const [user] = await sql`
      INSERT INTO users (email, password_hash, name, bio, roles, current_streak)
      VALUES ('user@habitpulse.com', ${passwordHash}, 'Demo User', 'Building better habits', ARRAY['user'], 5)
      RETURNING id
    `;

    // 3. Create Organizations
    console.log('Creating organizations...');
    const [org1] = await sql`
      INSERT INTO organizations (name, logo_url)
      VALUES ('HabitPulse Corp', 'https://ui-avatars.com/api/?name=HP&background=random')
      RETURNING id
    `;

    const [org2] = await sql`
      INSERT INTO organizations (name, logo_url)
      VALUES ('Community Runners', 'https://ui-avatars.com/api/?name=CR&background=random')
      RETURNING id
    `;

    await sql`INSERT INTO organization_members (organization_id, user_id, role) VALUES (${org1.id}, ${admin.id}, 'admin')`;
    await sql`INSERT INTO organization_members (organization_id, user_id, role) VALUES (${org1.id}, ${user.id}, 'member')`;
    await sql`INSERT INTO organization_members (organization_id, user_id, role) VALUES (${org2.id}, ${coach.id}, 'admin')`;

    // 4. Create Habits
    console.log('Creating habits...');
    const [habit1] = await sql`
      INSERT INTO habits (user_id, name, description, frequency, target_count, category)
      VALUES (${user.id}, 'Morning Meditation', '10 minutes of mindfulness', 'daily', 1, 'health')
      RETURNING id
    `;

    const [habit2] = await sql`
      INSERT INTO habits (user_id, name, description, frequency, target_count, category)
      VALUES (${user.id}, 'Drink Water', '3 Liters per day', 'daily', 3, 'health')
      RETURNING id
    `;
    
    // 5. Create Challenges
    console.log('Creating challenges...');
    const [challenge1] = await sql`
      INSERT INTO challenges (title, description, type, status, icon, is_public, start_date, end_date, target_days, organization_id) 
      VALUES ('Hydration Hero', 'Drink 8 glasses of water daily', 'individual', 'active', 'water_drop', true, NOW() - INTERVAL '2 days', NOW() + INTERVAL '12 days', 14, NULL)
      RETURNING id
    `;
    
    await sql`
       INSERT INTO challenges (title, description, type, status, icon, is_public, start_date, end_date, target_days, organization_id) 
       VALUES ('Step Challenge', '10k steps', 'competitive', 'active', 'directions_walk', true, NOW(), NOW() + INTERVAL '30 days', 30, ${org1.id})
    `;

    // 6. Create Protocols
    console.log('Creating protocols...');
    const [protocol1] = await sql`
        INSERT INTO protocols (name, description, creator_id, is_public)
        VALUES ('Morning Routine', 'Start your day right', ${coach.id}, true)
        RETURNING id
    `;

    await sql`
        INSERT INTO protocol_elements (protocol_id, title, type, frequency)
        VALUES (${protocol1.id}, 'Drink Water', 'check', 'daily'),
               (${protocol1.id}, 'Stretch', 'timer', 'daily')
    `;

    // Assign protocol to user
    await sql`
        INSERT INTO user_protocols (user_id, protocol_id, assigned_by)
        VALUES (${user.id}, ${protocol1.id}, ${coach.id})
    `;

    // 7. Create Tasks
    console.log('Creating tasks...');
    await sql`
      INSERT INTO tasks (user_id, habit_id, title) VALUES
      (${user.id}, ${habit1.id}, 'Meditate 10 mins'),
      (${user.id}, ${habit2.id}, 'Drink Bottle 1'),
      (${user.id}, ${habit2.id}, 'Drink Bottle 2'),
      (${user.id}, ${habit2.id}, 'Drink Bottle 3')
    `;

    // 8. Create Activity Logs
    console.log('Creating activity logs...');
    for (let i = 0; i < 7; i++) {
        const completed = Math.random() > 0.3; // 70% success
        if (completed) {
            await sql`
                INSERT INTO habit_logs (habit_id, user_id, completed_at)
                VALUES (${habit1.id}, ${user.id}, NOW() - make_interval(days => ${i}))
            `;
        }
    }

    return res.status(200).json({ status: 'ok', message: 'Database seeded successfully' });

  } catch (error: any) {
    console.error('Seed Error:', error);
    return res.status(500).json({ status: 'error', message: error.message });
  }
}
