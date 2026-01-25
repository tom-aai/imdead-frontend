import biometricContent from '@/app/components/legal/biometric_retention_and_destruction_policy.md';
import { MarkdownContent } from './markdown-content';

export function BiometricPolicy() {
  return <MarkdownContent content={biometricContent} />;
}
