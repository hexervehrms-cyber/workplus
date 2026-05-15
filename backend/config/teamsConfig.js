/**
 * Microsoft Teams Configuration
 * Handles Teams SDK setup and authentication
 */

import axios from 'axios';
import logger from '../utils/logger.js';

export const teamsConfig = {
  // Teams App Configuration
  appId: process.env.TEAMS_APP_ID,
  appPassword: process.env.TEAMS_APP_PASSWORD,
  tenantId: process.env.TEAMS_TENANT_ID,
  
  // Microsoft Graph API Configuration
  graphApiEndpoint: 'https://graph.microsoft.com/v1.0',
  
  // Bot Framework Configuration
  botId: process.env.TEAMS_BOT_ID,
  botPassword: process.env.TEAMS_BOT_PASSWORD,
  
  // Webhook Configuration
  webhookUrl: process.env.TEAMS_WEBHOOK_URL,
  
  // Token endpoints
  tokenEndpoint: 'https://login.microsoftonline.com/common/oauth2/v2.0/token',
  authorizeEndpoint: 'https://login.microsoftonline.com/common/oauth2/v2.0/authorize',
  
  // Scopes for Teams integration
  scopes: [
    'https://graph.microsoft.com/.default',
    'Chat.ReadWrite',
    'ChatMessage.Send',
    'User.Read',
    'User.ReadBasic.All'
  ]
};

/**
 * Get Microsoft Graph access token
 */
export const getTeamsAccessToken = async () => {
  try {
    const response = await axios.post(teamsConfig.tokenEndpoint, {
      client_id: teamsConfig.appId,
      client_secret: teamsConfig.appPassword,
      scope: teamsConfig.scopes.join(' '),
      grant_type: 'client_credentials'
    });
    
    return response.data.access_token;
  } catch (error) {
    logger.error('Failed to get Teams access token', error);
    throw new Error('Teams authentication failed');
  }
};

/**
 * Send message to Teams chat
 */
export const sendTeamsMessage = async (chatId, message) => {
  try {
    const token = await getTeamsAccessToken();
    
    const response = await axios.post(
      `${teamsConfig.graphApiEndpoint}/chats/${chatId}/messages`,
      {
        body: {
          content: message
        }
      },
      {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      }
    );
    
    return response.data;
  } catch (error) {
    logger.error('Failed to send Teams message', error);
    throw error;
  }
};

/**
 * Get Teams chat messages
 */
export const getTeamsChatMessages = async (chatId, limit = 50) => {
  try {
    const token = await getTeamsAccessToken();
    
    const response = await axios.get(
      `${teamsConfig.graphApiEndpoint}/chats/${chatId}/messages?$top=${limit}`,
      {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      }
    );
    
    return response.data.value;
  } catch (error) {
    logger.error('Failed to get Teams chat messages', error);
    throw error;
  }
};

/**
 * Create Teams chat
 */
/**
 * Resolve Azure AD user id by email (for Graph organizer)
 */
export const getGraphUserIdByEmail = async (email) => {
  const token = await getTeamsAccessToken();
  const response = await axios.get(
    `${teamsConfig.graphApiEndpoint}/users/${encodeURIComponent(email)}`,
    {
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
    }
  );
  return response.data.id;
};

/**
 * Create a Microsoft Teams online meeting (real Teams — joinWebUrl for in-app embed)
 */
export const createTeamsOnlineMeeting = async (organizerEmail, subject, withVideo = true) => {
  const token = await getTeamsAccessToken();
  const organizerId =
    process.env.TEAMS_ORGANIZER_USER_ID ||
    (await getGraphUserIdByEmail(
      process.env.TEAMS_ORGANIZER_EMAIL || organizerEmail
    ));

  const start = new Date();
  const end = new Date(Date.now() + 60 * 60 * 1000);

  const response = await axios.post(
    `${teamsConfig.graphApiEndpoint}/users/${organizerId}/onlineMeetings`,
    {
      startDateTime: start.toISOString(),
      endDateTime: end.toISOString(),
      subject: subject || 'WorkPlus meeting',
      lobbyBypassSettings: { scope: 'everyone', isDialInBypassEnabled: true },
      allowedPresenters: 'everyone',
    },
    {
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
    }
  );

  return {
    joinWebUrl: response.data.joinWebUrl,
    meetingId: response.data.id,
    subject: response.data.subject,
    withVideo,
  };
};

export const createTeamsChat = async (participants, topic) => {
  try {
    const token = await getTeamsAccessToken();
    
    const response = await axios.post(
      `${teamsConfig.graphApiEndpoint}/chats`,
      {
        chatType: 'oneOnOne',
        members: participants.map(p => ({
          '@odata.type': '#microsoft.graph.aadUserConversationMember',
          roles: ['owner'],
          'user@odata.bind': `https://graph.microsoft.com/v1.0/users/${p}`
        })),
        topic: topic
      },
      {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      }
    );
    
    return response.data;
  } catch (error) {
    logger.error('Failed to create Teams chat', error);
    throw error;
  }
};

export default teamsConfig;
