/** セットの左右(ADR-018)。データ上は属性 '右' / '左' のどちらか 1 つ(無ければ付けない) */
export const SIDE_ATTRIBUTES = ['右', '左'] as const
export type SetSide = (typeof SIDE_ATTRIBUTES)[number]

export const isSideAttribute = (name: string): boolean =>
  (SIDE_ATTRIBUTES as readonly string[]).includes(name.trim())

/** 属性から左右を読む(両方付いた古いデータは先に見つかった '右' を優先) */
export function sideOf(attributes: readonly string[] | undefined): SetSide | undefined {
  return SIDE_ATTRIBUTES.find((s) => attributes?.includes(s))
}

/** 無 → 右 → 左 → 無 の順に切り替えた後の属性(左右以外の属性と並びはそのまま) */
export function cycleSideAttributes(
  attributes: readonly string[] | undefined,
): string[] | undefined {
  const current = sideOf(attributes)
  const next: SetSide | undefined =
    current === undefined ? '右' : current === '右' ? '左' : undefined
  const rest = (attributes ?? []).filter((a) => !isSideAttribute(a))
  const result = next ? [...rest, next] : rest
  return result.length > 0 ? result : undefined
}
