import { describe, expect, it } from 'vitest'
import { floatingBottom, isKeyboardOpen, keyboardHeight } from './keyboardTimer'

describe('isKeyboardOpen', () => {
  it('キーボードが閉じていれば false', () => {
    expect(isKeyboardOpen({ innerHeight: 750, viewportHeight: 750, offsetTop: 0 })).toBe(false)
  })

  it('アドレスバー伸縮程度の差(60px)は無視する', () => {
    expect(isKeyboardOpen({ innerHeight: 750, viewportHeight: 690, offsetTop: 0 })).toBe(false)
  })

  it('数字キーボードが開いていれば true', () => {
    expect(isKeyboardOpen({ innerHeight: 750, viewportHeight: 460, offsetTop: 0 })).toBe(true)
  })

  it('ページがずれていても(offsetTop が大きくても)判定は変わらない', () => {
    // offsetTop を差し引いて判定すると 290 - 290 = 0 で閾値を割り、ボタンが一瞬で消える
    expect(isKeyboardOpen({ innerHeight: 750, viewportHeight: 460, offsetTop: 290 })).toBe(true)
  })
})

describe('floatingBottom', () => {
  it('ページがずれていなければキーボード上端の 8px 上', () => {
    expect(floatingBottom({ innerHeight: 750, viewportHeight: 460, offsetTop: 0 })).toBe(298)
  })

  it('iOS が下側の入力欄を見せてページをずらした分だけ差し引く', () => {
    // 差し引かないと 298 のまま = 画面上では 290px 上へ飛び、可視領域(452px)の外へ出る
    expect(floatingBottom({ innerHeight: 750, viewportHeight: 460, offsetTop: 290 })).toBe(8)
    expect(floatingBottom({ innerHeight: 750, viewportHeight: 460, offsetTop: 150 })).toBe(148)
  })

  it('ずれがキーボード高さを超えても下限 8px に丸める', () => {
    // 文字キーボード + 小さい端末。開閉アニメーション中に起こりうる
    expect(floatingBottom({ innerHeight: 660, viewportHeight: 300, offsetTop: 400 })).toBe(8)
  })
})

describe('keyboardHeight', () => {
  it('負にはならない', () => {
    expect(keyboardHeight({ innerHeight: 700, viewportHeight: 780, offsetTop: 0 })).toBe(0)
  })
})
