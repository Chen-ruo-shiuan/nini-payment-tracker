@AGENTS.md

# NINI の 療癒所 管理系統

Next.js App Router + better-sqlite3 + Railway 部署。繁體中文 UI，行動裝置優先。

## 技術棧

- **框架**：Next.js App Router（TypeScript）
- **資料庫**：better-sqlite3（SQLite），DB 路徑由 `DATABASE_URL` 環境變數控制，預設 `data/nini.db`
- **樣式**：Tailwind CSS + inline styles（暖色系 `#faf8f5 / #2c2825`）
- **部署**：Railway（`railway.toml` + `nixpacks.toml`）

## 專案結構

```
app/                  # Next.js App Router 頁面
  api/                # API routes（runtime = 'nodejs'）
    checkouts/        # 結帳 CRUD + [id]/route.ts（PATCH/DELETE）
    clients/          # 客人 CRUD + [id]/route.ts
    packages/         # 套組 CRUD + [id]/route.ts（PATCH）
                      #           + [id]/use/route.ts（POST/DELETE）
                      #           + [id]/recalc/route.ts（POST）
    reports/          # 報表 API（日/月/年）
    sv-ledger/        # 儲值金帳本
    expenses/         # 支出
    installments/     # 分期付款
  checkout/           # 結帳頁面
  clients/            # 客人列表 + [id] 詳細頁
  packages/           # 套組列表 + new/
  reports/            # 報表頁面
  installments/       # 分期列表
  expenses/           # 支出列表
components/
  NavBar.tsx          # 頂部標題 + 底部 7 分頁導覽（grid-cols-7）
  MembershipBadge.tsx
lib/
  db.ts               # getDb() + 所有 migration 函式
types/
  index.ts            # 所有共用型別與常數
```

## 資料庫 Migration 規則

所有 schema 變更一律在 `lib/db.ts` 新增 migration 函式，並在 `getDb()` 內呼叫。
絕對不能直接修改 `initSchema`（這會破壞已存在的資料庫）。

```typescript
// 範例：新增欄位
function migrateXxx(db: Database.Database) {
  const cols = (db.prepare('PRAGMA table_info(table_name)').all() as { name: string }[]).map(c => c.name)
  if (!cols.includes('new_col')) {
    db.exec(`ALTER TABLE table_name ADD COLUMN new_col TEXT`)
  }
}
// 然後在 getDb() 內加上呼叫
```

## 核心業務邏輯

### 品項類別（checkout_items.category）
- `服務`、`加購`、`活動`：計入年度課程消費（`incl_course=1` 時）
- `產品`：計入保養品消費（`incl_product=1` 時）
- `商品券`：套組核銷，**永遠不計入任何消費統計**（已在套組購買時預收）

### 套組（packages）
- `include_in_accumulation=1`：預收金額計入年度課程消費（升等用）
- `include_in_points=1`：預收金額計入金米積分
- 使用商品券核銷時自動更新 `used_sessions`
- 刪除/編輯結帳時自動還原 `used_sessions`

### 年度消費計算（升等進度）
```
annualCourseSpending
  = 當年 incl_course 結帳的 [服務/加購/活動] 品項金額
  + 當年 include_in_accumulation=1 的套組 prepaid_amount
```

### 付款方式連動
- 付款方式為 `儲值金` → 自動在 `sv_ledger` 寫入負值記錄
- 刪除/編輯結帳時自動還原 sv_ledger

### 會員等級顏色
| 等級 | 背景 | 文字 | 邊框 |
|------|------|------|------|
| 癒米 | #f0ede8 | #706c68 | #c8c4be |
| 甜癒米 | #fce8f0 | #9a3060 | #e8a0c0 |
| 療癒米 | #e8f0fc | #2d4f9a | #9ab0e8 |
| 悟癒米（金米） | #fdf5e0 | #7a5a00 | #e0c055 |
| 下午茶 | #e6f5f0 | #1a6b5a | #5ab89e |

### 付款方式清單（types/index.ts）
`現金 / 匯款 / LINE Pay / 分期 / 核銷 / 儲值金 / 金米 / 商品券 / 優惠折扣`
結帳介面過濾掉 `分期` 和 `核銷`。

## API 慣例

- 所有 API route 必須加 `export const runtime = 'nodejs'`
- params 必須 `await`：`const { id } = await params`
- 需要 transaction 的操作用 `db.transaction(() => { ... })()`

## UI 慣例

- 主色：`#2c2825`（深褐）、`#faf8f5`（米白底）、`#e0d9d0`（邊框）
- 輔助文字：`#9a8f84`、`#6b5f54`
- 成功綠：`#9ab89e`、`#edf3eb`
- 客人姓名排序：筆劃順序（`lib/db.ts` 內的 `STROKES` 對照表）

## 常見操作

```bash
# 本地開發
npm run dev

# 部署（push to Railway）
git push
```
