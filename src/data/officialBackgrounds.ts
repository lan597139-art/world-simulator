export type OfficialBackground = {
  key: string
  url: string
  nameZh: string
  nameEn: string
  categoryZh: string
  categoryEn: string
}

/** 平台内置、无版权风险的可选背景；不依赖外部照片库。 */
export const OFFICIAL_BACKGROUNDS: OfficialBackground[] = [
  {
    key: 'mist-forest', url: '/backgrounds/mist-forest.svg',
    nameZh: '雾林', nameEn: 'Mist Forest',
    categoryZh: '自然', categoryEn: 'Nature',
  },
  {
    key: 'dusk-coast', url: '/backgrounds/dusk-coast.svg',
    nameZh: '暮色海岸', nameEn: 'Dusk Coast',
    categoryZh: '自然', categoryEn: 'Nature',
  },
  {
    key: 'aurora-night', url: '/backgrounds/aurora-night.svg',
    nameZh: '极光夜', nameEn: 'Aurora Night',
    categoryZh: '夜色', categoryEn: 'Night',
  },
  {
    key: 'desert-dune', url: '/backgrounds/desert-dune.svg',
    nameZh: '沙丘', nameEn: 'Desert Dune',
    categoryZh: '自然', categoryEn: 'Nature',
  },
  {
    key: 'ink-mountain', url: '/backgrounds/ink-mountain.svg',
    nameZh: '水墨山峦', nameEn: 'Ink Mountain',
    categoryZh: '极简', categoryEn: 'Minimal',
  },
  {
    key: 'neon-city', url: '/backgrounds/neon-city.svg',
    nameZh: '霓虹城市', nameEn: 'Neon City',
    categoryZh: '夜色', categoryEn: 'Night',
  },
]

export function isOfficialBackground(url: string): boolean {
  return OFFICIAL_BACKGROUNDS.some((item) => item.url === url)
}
