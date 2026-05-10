import fs from 'fs';
import path from 'path';

const envContent = `PORT=5000
NODE_ENV=production
MONGODB_URI=mongodb+srv://atulcse08_db_user:Jadu%40123@workplus.tcf4qho.mongodb.net/workpluspro?retryWrites=true&w=majority
JWT_SECRET=workplus-pro-production-jwt-secret-key-minimum-32-characters-long-secure-2024-v1
JWT_EXPIRES_IN=24h
CORS_ORIGIN=https://hexerve.online,https://www.hexerve.online,https://workplus-qbshegha8-hexervehrms-8667s-projects.vercel.app
FRONTEND_URL=https://hexerve.online
SUPER_ADMIN_EMAIL=atul@hexerve.com
SUPER_ADMIN_PASSWORD=Jadu@123
SUPER_ADMIN_NAME=Atul
`;

const envPath = path.join(process.cwd(), 'backend', '.env');
fs.writeFileSync(envPath, envContent, 'utf8');
console.log('✅ .env file created successfully');
console.log('Content:', envContent);
