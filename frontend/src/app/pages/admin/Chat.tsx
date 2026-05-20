import TeamsMessenger from '../../components/TeamsMessenger';
import { OrgRequiredNotice } from '../../components/OrgRequiredNotice';
import { useAuth } from '../../context/AuthContext';

export default function AdminChat() {
  const { user } = useAuth();

  return (
    <div className="h-full min-h-0 flex flex-col overflow-hidden">
      <div className="shrink-0 px-4 pt-4">
        <OrgRequiredNotice user={user} />
      </div>
      <div className="flex-1 min-h-0 flex flex-col overflow-hidden">
        <TeamsMessenger />
      </div>
    </div>
  );
}
