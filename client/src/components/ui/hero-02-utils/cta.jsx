import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button-shadcn';

export function Cta({ cta }) {
  if (!cta?.ctaEnabled) return null;

  if (cta.onClick) {
    return (
      <Button variant={cta.variant || 'default'} size={cta.size || 'default'} onClick={cta.onClick}>
        {cta.text}
      </Button>
    );
  }

  if (cta.link) {
    return (
      <Button variant={cta.variant || 'default'} size={cta.size || 'default'} asChild>
        <Link to={cta.link}>{cta.text}</Link>
      </Button>
    );
  }

  return (
    <Button variant={cta.variant || 'default'} size={cta.size || 'default'}>
      {cta.text}
    </Button>
  );
}
