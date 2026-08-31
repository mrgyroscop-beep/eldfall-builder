import GuildApp from '@/components/guild-app';
import { catalog } from '@/lib/catalog';
export default function Home() {
  return <GuildApp catalog={catalog} />;
}
