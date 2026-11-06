
import type { CatalogModule } from '../types/worldBuilding'

export const A1_CATALOG: CatalogModule[] = [
  {
    id: 'A1',
    name: '文明硬件',
    description: '世界的技术、工业与基础设施等文明基础',
    sourceOrder: 1,
    sections: [
      {
        id: 'A1.1',
        name: '技术与工业',
        description: '扩展选项 + WEP 参数映射',
        sourceOrder: 1,
        groups: [
          {
            id: 'A1.1-G1',
            name: '技术发展阶段',
            selectionMode: 'single',
            sourceOrder: 1,
            options: [
              { id: 'A1.1-G1-O1', name: '原始社会', description: '石器、狩猎采集', sourceOrder: 1 },
              { id: 'A1.1-G1-O2', name: '农业社会', description: '农业、手工业、传统生产', sourceOrder: 2 },
              { id: 'A1.1-G1-O3', name: '古典文明', description: '城市、冶金、成熟手工业', sourceOrder: 3 },
              { id: 'A1.1-G1-O4', name: '蒸汽工业', description: '蒸汽机、机械化生产', sourceOrder: 4 },
              { id: 'A1.1-G1-O5', name: '电气工业', description: '电力、规模化工业', sourceOrder: 5 },
              { id: 'A1.1-G1-O6', name: '信息社会', description: '互联网、数字化生产', sourceOrder: 6 },
              { id: 'A1.1-G1-O7', name: '智能社会', description: '人工智能、高度自动化', sourceOrder: 7 },
              { id: 'A1.1-G1-O8', name: '未来科技', description: '超越现实科技水平', sourceOrder: 8 },
              { id: 'A1.1-G1-O9', name: '魔法文明', description: '魔法承担部分技术功能', sourceOrder: 9 },
              { id: 'A1.1-G1-O10', name: '混合文明', description: '科技与魔法并存', sourceOrder: 10 },
            ],
          },
          {
            id: 'A1.1-G2',
            name: '工业与基础设施状态',
            selectionMode: 'single',
            sourceOrder: 2,
            options: [
              { id: 'A1.1-G2-O1', name: '几乎没有工业体系', sourceOrder: 1 },
              { id: 'A1.1-G2-O2', name: '手工业为主', sourceOrder: 2 },
              { id: 'A1.1-G2-O3', name: '初步工业化', sourceOrder: 3 },
              { id: 'A1.1-G2-O4', name: '工业体系成熟', sourceOrder: 4 },
              { id: 'A1.1-G2-O5', name: '高度自动化', sourceOrder: 5 },
              { id: 'A1.1-G2-O6', name: '极端先进的生产体系', sourceOrder: 6 },
              { id: 'A1.1-G2-O7', name: '工业体系衰退或崩溃', sourceOrder: 7 },
            ],
          },
        ],
      },
    ],
  },
]

export const A1_1_PARAMETERS = [
  {
    key: 'Tech_Level',
    name: '技术高度',
  },
  {
    key: 'Tech_Diffusion',
    name: '技术普及度',
  },
  {
    key: 'Infrastructure',
    name: '基建、水电、物流稳定度',
  },
]
