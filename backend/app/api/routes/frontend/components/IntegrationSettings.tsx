import React, { useState } from 'react';
import { 
  Card, 
  CardContent, 
  CardHeader, 
  CardTitle,
  CardDescription
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from '@/components/ui/select';
import { toast } from 'sonner';

const INTEGRATIONS = [
  { id: 'attio', name: 'Attio', description: 'CRM for startups' },
  { id: 'notion', name: 'Notion', description: 'Connected workspace' },
  { id: 'slack', name: 'Slack', description: 'Team communication' },
  { id: 'hubspot', name: 'HubSpot', description: 'Marketing & Sales CRM' },
  { id: 'affinity', name: 'Affinity', description: 'Relationship intelligence' },
  { id: 'zapier', name: 'Zapier', description: 'Automation' },
];

export const IntegrationSettings = ({ transcriptId }: { transcriptId?: string }) => {
  const [selected, setSelected] = useState('');
  const [loading, setLoading] = useState(false);
  const [config, setConfig] = useState<any>({});

  const handleSend = async () => {
    if (!selected) return;
    setLoading(true);
    try {
      const response = await fetch(`/api/transcripts/${transcriptId}/send-to/${selected}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(config)
      });
      
      const data = await response.json();
      if (data.success) {
        toast.success(`Successfully sent to ${selected}`);
      } else {
        toast.error(data.error || 'Failed to send');
      }
    } catch (err) {
      toast.error('An error occurred');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle>Advanced Integrations</CardTitle>
        <CardDescription>Connect MeetScribe to your workflow</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Label>Select Integration</Label>
          <Select onValueChange={setSelected}>
            <SelectTrigger>
              <SelectValue placeholder="Choose an app..." />
            </SelectTrigger>
            <SelectContent>
              {INTEGRATIONS.map(app => (
                <SelectItem key={app.id} value={app.id}>
                  {app.name} - {app.description}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {selected && (
          <div className="space-y-4 border-t pt-4">
            <div className="space-y-2">
              <Label>API Key / Webhook URL</Label>
              <Input 
                type="password" 
                placeholder="Enter credentials..."
                onChange={(e) => setConfig({ ...config, api_key: e.target.value, webhook_url: e.target.value })}
              />
            </div>
            
            {selected === 'notion' && (
              <div className="space-y-2">
                <Label>Database / Page ID</Label>
                <Input 
                  placeholder="Notion ID..."
                  onChange={(e) => setConfig({ ...config, parent_id: e.target.value })}
                />
              </div>
            )}

            <Button 
              className="w-full" 
              onClick={handleSend}
              disabled={loading || !transcriptId}
            >
              {loading ? 'Sending...' : `Send to ${selected}`}
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
};
