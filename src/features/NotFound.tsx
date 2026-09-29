import { Compass } from 'lucide-react';
import { useNavigate } from 'react-router';
import { Page } from '@/components/layout/Page';
import { Button } from '@/components/ui/Button';
import { EmptyState } from '@/components/ui/EmptyState';

export default function NotFound() {
  const navigate = useNavigate();
  return (
    <Page className="pt-16">
      <EmptyState
        icon={Compass}
        level={1}
        title="هالصفحة مو موجودة"
        description="يمكن الرابط قديم أو الفكرة انحذفت."
        action={
          <Button variant="primary" onClick={() => navigate('/')}>
            الرجوع للرئيسية
          </Button>
        }
      />
    </Page>
  );
}
