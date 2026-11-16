export type OfficialBackground = {
  key: string
  url: string
  nameZh: string
  nameEn: string
  categoryZh: string
  categoryEn: string
  kind?: 'illustration' | 'photo'
  tagsZh?: string[]
  tagsEn?: string[]
  credit?: string
  licenseUrl?: string
}

/** 平台内置素材：原创插画 + 按 Unsplash License 使用的本地化照片。 */
export const OFFICIAL_BACKGROUNDS: OfficialBackground[] = [
  {
    key: 'mist-forest', url: '/backgrounds/mist-forest.svg',
    nameZh: '雾林', nameEn: 'Mist Forest',
    categoryZh: '自然', categoryEn: 'Nature', kind: 'illustration',
  },
  {
    key: 'dusk-coast', url: '/backgrounds/dusk-coast.svg',
    nameZh: '暮色海岸', nameEn: 'Dusk Coast',
    categoryZh: '自然', categoryEn: 'Nature', kind: 'illustration',
  },
  {
    key: 'aurora-night', url: '/backgrounds/aurora-night.svg',
    nameZh: '极光夜', nameEn: 'Aurora Night',
    categoryZh: '夜色', categoryEn: 'Night', kind: 'illustration',
  },
  {
    key: 'desert-dune', url: '/backgrounds/desert-dune.svg',
    nameZh: '沙丘', nameEn: 'Desert Dune',
    categoryZh: '自然', categoryEn: 'Nature', kind: 'illustration',
  },
  {
    key: 'ink-mountain', url: '/backgrounds/ink-mountain.svg',
    nameZh: '水墨山峦', nameEn: 'Ink Mountain',
    categoryZh: '极简', categoryEn: 'Minimal', kind: 'illustration',
  },
  {
    key: 'neon-city', url: '/backgrounds/neon-city.svg',
    nameZh: '霓虹城市', nameEn: 'Neon City',
    categoryZh: '夜色', categoryEn: 'Night', kind: 'illustration',
  },
  {
    key: 'forest-light', url: '/official-photos/forest-light.jpg',
    nameZh: '林间晨光', nameEn: 'Forest Light', categoryZh: '自然', categoryEn: 'Nature', kind: 'photo',
    tagsZh: ['森林', '晨光', '绿色'], tagsEn: ['forest', 'morning', 'green'], credit: 'Unsplash', licenseUrl: 'https://unsplash.com/license',
  },
  {
    key: 'mist-mountain', url: '/official-photos/mist-mountain.jpg',
    nameZh: '雾中山脊', nameEn: 'Misty Ridge', categoryZh: '自然', categoryEn: 'Nature', kind: 'photo',
    tagsZh: ['山', '雾', '远景'], tagsEn: ['mountain', 'mist', 'landscape'], credit: 'Unsplash', licenseUrl: 'https://unsplash.com/license',
  },
  {
    key: 'quiet-coast', url: '/official-photos/quiet-coast.jpg',
    nameZh: '静默海岸', nameEn: 'Quiet Coast', categoryZh: '自然', categoryEn: 'Nature', kind: 'photo',
    tagsZh: ['海', '沙滩', '蓝色'], tagsEn: ['sea', 'beach', 'blue'], credit: 'Unsplash', licenseUrl: 'https://unsplash.com/license',
  },
  {
    key: 'city-gold', url: '/official-photos/city-gold.jpg',
    nameZh: '金色街区', nameEn: 'Golden City', categoryZh: '城市', categoryEn: 'City', kind: 'photo',
    tagsZh: ['城市', '建筑', '黄昏'], tagsEn: ['city', 'architecture', 'dusk'], credit: 'Unsplash', licenseUrl: 'https://unsplash.com/license',
  },
  {
    key: 'desert-ridge', url: '/official-photos/desert-ridge.jpg',
    nameZh: '沙海脊线', nameEn: 'Desert Ridge', categoryZh: '自然', categoryEn: 'Nature', kind: 'photo',
    tagsZh: ['沙漠', '荒原', '暖色'], tagsEn: ['desert', 'wild', 'warm'], credit: 'Unsplash', licenseUrl: 'https://unsplash.com/license',
  },
  {
    key: 'aurora-sky', url: '/official-photos/aurora-sky.jpg',
    nameZh: '极光长夜', nameEn: 'Aurora Night', categoryZh: '夜色', categoryEn: 'Night', kind: 'photo',
    tagsZh: ['极光', '星空', '夜色'], tagsEn: ['aurora', 'stars', 'night'], credit: 'Unsplash', licenseUrl: 'https://unsplash.com/license',
  },
  {
    key: 'studio-interior', url: '/official-photos/studio-interior.jpg',
    nameZh: '安静室内', nameEn: 'Quiet Interior', categoryZh: '室内', categoryEn: 'Interior', kind: 'photo',
    tagsZh: ['室内', '书桌', '工作'], tagsEn: ['interior', 'desk', 'studio'], credit: 'Unsplash', licenseUrl: 'https://unsplash.com/license',
  },
  {
    key: 'lake-mirror', url: '/official-photos/lake-mirror.jpg',
    nameZh: '湖面倒影', nameEn: 'Lake Mirror', categoryZh: '自然', categoryEn: 'Nature', kind: 'photo',
    tagsZh: ['湖', '倒影', '群山'], tagsEn: ['lake', 'reflection', 'mountains'], credit: 'Unsplash', licenseUrl: 'https://unsplash.com/license',
  },
]

export function isOfficialBackground(url: string): boolean {
  return OFFICIAL_BACKGROUNDS.some((item) => item.url === url)
}
