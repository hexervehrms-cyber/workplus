/**
 * Microsoft Teams Configuration
 * Handles Teams SDK setup and authentication
 */

import axios from 'axios';
import logger from '../utils/logger.js';

export const teamsConfig = {
  appId: process.env.TEAMS_APP_ID,
  appPassword: process.env.TEAMS_APP_PASSWORD,
  tenantId: process.env.TEAMS_TENANT_ID,
  graphApiEndpoint: 'https://graph.microsoft.com/v1.0',
  botId: process.env.TEAMS_BOT_ID,
  botPassword: process.env.TEAMS_BOT_PASSWORD,
  webhookUrl: process.env.TEAMS_WEBHOOK_URL,
};

/** True when Azure app credentials are present for Graph client-credentials flow */
export const isTeamsConfigured = () =>
  Boolean(teamsConfig.appId && teamsConfig.appPassword && teamsConfig.tenantId);

const getTokenEndpoint = () => {
  const tenant = teamsConfig.tenantId || 'common';
  return `https://login.microsoftonline.com/${tenant}/oauth2/v2.0/token`;
};

const graphErrorMessage = (error) => {
  const data = error?.response?.data;
  return (
    data?.error_description ||
    data?.error?.message ||
    data?.message ||
    error?.message
  );
};

/**
 * Get Microsoft Graph access token (client credentials)
 */
export const getTeamsAccessToken = async () => {
  if (!isTeamsConfigured()) {
    throw new Error(
      'Teams is not configured. Set TEAMS_APP_ID, TEAMS_APP_PASSWORD, and TEAMS_TENANT_ID.'
    );
  }

  try {
    const params = new URLSearchParams({
      client_id: teamsConfig.appId,
      client_secret: teamsConfig.appPassword,
      scope: 'https://graph.microsoft.com/.default',
      grant_type: 'client_credentials',
    });

    const response = await axios.post(getTokenEndpoint(), params.toString(), {
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    });

    return response.data.access_token;
  } catch (error) {
    const detail = graphErrorMessage(error);
    logger.error('Failed to get Teams access token', { detail });
    throw new Error(detail || 'Teams authentication failed');
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
          content: message,
        },
      },
      {
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
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
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      }
    );

    return response.data.value;
  } catch (error) {
    logger.error('Failed to get Teams chat messages', error);
    throw error;
  }
};

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
 * Create a Microsoft Teams online meeting
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

  try {
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
  } catch (error) {
    const detail = graphErrorMessage(error);
    logger.error('Failed to create Teams online meeting', { detail, organizerId });
    throw new Error(
      detail ||
        'Failed to create Teams meeting. Grant OnlineMeetings.ReadWrite.All to the app.'
    );
  }
};

export const createTeamsChat = async (participants, topic) => {
  try {
    const token = await getTeamsAccessToken();

    const response = await axios.post(
      `${teamsConfig.graphApiEndpoint}/chats`,
      {
        chatType: 'oneOnOne',
        members: participants.map((p) => ({
          '@odata.type': '#microsoft.graph.aadUserConversationMember',
          roles: ['owner'],
          'user@odata.bind': `https://graph.microsoft.com/v1.0/users/${p}`,
        })),
        topic,
      },
      {
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      }
    );

    return response.data;
  } catch (error) {
    logger.error('Failed to create Teams chat', error);
    throw error;
  }
};

export default teamsConfig;
