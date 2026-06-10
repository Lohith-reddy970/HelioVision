import { ProtectedRoute } from '@/components/ProtectedRoute';

export default function SolarEstimationLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <ProtectedRoute>{children}</ProtectedRoute>;
}
