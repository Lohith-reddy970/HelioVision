import { ProtectedRoute } from '@/components/ProtectedRoute';

export default function RoofDetectionLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <ProtectedRoute>{children}</ProtectedRoute>;
}
