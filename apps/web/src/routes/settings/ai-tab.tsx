import { useCallback, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { useUpdateSettings } from '@/hooks/use-settings';
import { cn } from '@/lib/utils';
import type { StatusMessage } from './types';
import { AgentSection } from './agent-section';

export function AiTab({ settings, onToast }: { settings: Record<string, string>; onToast: (msg: StatusMessage) => void }) {
  const updateSettings = useUpdateSettings();
  const [provider, setProvider] = useState(settings.llm_provider ?? '');
  const [apiKey, setApiKey] = useState('');
  const [model, setModel] = useState(settings.llm_model ?? '');
  const [baseUrl, setBaseUrl] = useState(settings.llm_base_url ?? '');

  const hasExistingKey = Boolean(
    settings.llm_api_key && settings.llm_api_key.includes('****'),
  );

  const handleSave = useCallback(async () => {
    try {
      const data: Record<string, string> = {
        llm_provider: provider,
        llm_model: model,
        llm_base_url: baseUrl,
      };
      if (apiKey) data.llm_api_key = apiKey;
      await updateSettings.mutateAsync(data);
      setApiKey('');
      onToast({ type: 'info', text: 'AI 配置已保存' });
    } catch {
      onToast({ type: 'error', text: '保存失败' });
    }
  }, [provider, apiKey, model, baseUrl, updateSettings, onToast]);

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader className="pb-4">
          <CardTitle className="text-base">AI 服务配置</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <p className="mb-2 text-sm font-medium text-foreground">LLM 提供商</p>
            <div className="flex gap-1 rounded-lg border border-border bg-popover p-0.5">
              {(['', 'openai', 'anthropic', 'deepseek', 'ollama'] as const).map((v) => (
                <button
                  key={v}
                  type="button"
                  className={cn(
                    'rounded-md px-3 py-1.5 text-sm transition-colors',
                    provider === v
                      ? 'bg-primary text-primary-foreground'
                      : 'text-muted-foreground hover:text-foreground',
                  )}
                  onClick={() => setProvider(v)}
                >
                  {v === '' ? '关闭' : v === 'openai' ? 'OpenAI' : v === 'anthropic' ? 'Anthropic' : v === 'deepseek' ? 'DeepSeek' : 'Ollama'}
                </button>
              ))}
            </div>
          </div>

          <div>
            <p className="mb-1.5 text-sm font-medium text-foreground">API Key</p>
            <Input
              type="password"
              placeholder={hasExistingKey ? '已配置（留空不修改）' : 'sk-...'}
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
            />
          </div>

          <div>
            <p className="mb-1.5 text-sm font-medium text-foreground">模型</p>
            <Input
              placeholder="gpt-4o / claude-3.5-sonnet / deepseek-chat"
              value={model}
              onChange={(e) => setModel(e.target.value)}
            />
          </div>

          <div>
            <p className="mb-1.5 text-sm font-medium text-foreground">Base URL（可选）</p>
            <p className="mb-1.5 text-xs text-muted-foreground">自定义 API 地址，留空使用默认</p>
            <Input
              placeholder="https://api.openai.com/v1"
              value={baseUrl}
              onChange={(e) => setBaseUrl(e.target.value)}
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-4">
          <CardTitle className="text-base">功能状态</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex items-center justify-between rounded-lg border border-border px-4 py-3">
            <div>
              <p className="text-sm font-medium text-foreground">录入辅助</p>
              <p className="text-xs text-muted-foreground">元数据补全、标签/分类建议、重复发现</p>
            </div>
            <span className="text-xs text-muted-foreground">M3 上线</span>
          </div>
          <div className="flex items-center justify-between rounded-lg border border-border px-4 py-3">
            <div>
              <p className="text-sm font-medium text-foreground">阅读辅助</p>
              <p className="text-xs text-muted-foreground">摘要生成、问题整理、章节总结</p>
            </div>
            <span className="text-xs text-muted-foreground">M3 上线</span>
          </div>
          <div className="flex items-center justify-between rounded-lg border border-border px-4 py-3">
            <div>
              <p className="text-sm font-medium text-foreground">书库问答（RAG）</p>
              <p className="text-xs text-muted-foreground">基于个人书库的语义问答与主题分析</p>
            </div>
            <span className="text-xs text-muted-foreground">M4 上线</span>
          </div>
        </CardContent>
      </Card>

      <AgentSection onToast={onToast} />

      <div className="flex justify-end">
        <Button onClick={handleSave} disabled={updateSettings.isPending}>
          {updateSettings.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
          保存配置
        </Button>
      </div>
    </div>
  );
}
