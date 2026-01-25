import tosContent from '@/app/components/legal/tos.md';
import { MarkdownContent } from './markdown-content';

export function TermsOfService() {
  return <MarkdownContent content={tosContent} />;
}
