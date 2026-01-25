import ppContent from '@/app/components/legal/pp.md';
import { MarkdownContent } from './markdown-content';

export function PrivacyPolicy() {
  return <MarkdownContent content={ppContent} />;
}
