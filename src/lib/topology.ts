import type { Service } from './types';

export const SERVICES: Service[] = [
  {
    id: 'api-gateway',
    name: 'API Gateway',
    status: 'healthy',
    cpu: 25,
    latency: 45,
    errorRate: 0,
    dependencies: ['auth-service', 'order-service'],
  },
  {
    id: 'auth-service',
    name: 'Auth Service',
    status: 'healthy',
    cpu: 15,
    latency: 30,
    errorRate: 0,
    dependencies: ['user-db'],
  },
  {
    id: 'order-service',
    name: 'Order Service',
    status: 'healthy',
    cpu: 35,
    latency: 80,
    errorRate: 0,
    dependencies: ['user-db'],
  },
  {
    id: 'user-db',
    name: 'User Database',
    status: 'healthy',
    cpu: 20,
    latency: 10,
    errorRate: 0,
    dependencies: [],
  },
];

export function areDependents(a: string, b: string): boolean {
  const svcA = SERVICES.find((s) => s.id === a);
  const svcB = SERVICES.find((s) => s.id === b);
  if (!svcA || !svcB) return false;
  return (
    svcA.dependencies.includes(b) ||
    svcB.dependencies.includes(a) ||
    svcA.dependencies.some((d) => svcB.dependencies.includes(d))
  );
}
