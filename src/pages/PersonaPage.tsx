import { YunbaoProfilePanel } from '../components/YunbaoProfile'

export default function PersonaPage({ onOpenSeedEditor }: { onOpenSeedEditor?: () => void }) {
  return <YunbaoProfilePanel embedded onOpenSeedEditor={onOpenSeedEditor} />
}
