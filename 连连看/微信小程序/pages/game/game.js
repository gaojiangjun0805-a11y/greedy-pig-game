// 公约数列 · 微信小程序 game.js
// 游戏逻辑从 HTML 版移植，核心算法完全一致

const DIFF_CONFIG = {
  1: { cols:5, rows:5, maxVal:50,  timeLimit:120, primes:[2,3,5,7],       paid: false },
  2: { cols:6, rows:6, maxVal:100, timeLimit:150, primes:[2,3,5,7,11],    paid: true  },
  3: { cols:7, rows:7, maxVal:200, timeLimit:180, primes:[2,3,5,7,11,13], paid: true  },
}

const PAD = 8   // rpx → 换算时用像素
const GAP = 5
const MAX_UNDO = 20

// ── 工具函数 ──────────────────────────────────────────────
function gcd(a, b) { while (b) [a, b] = [b, a % b]; return a }

function uniquePF(n) {
  const f = new Set()
  for (let p = 2; p * p <= n; p++) {
    if (n % p === 0) { f.add(p); while (n % p === 0) n /= p }
  }
  if (n > 1) f.add(n)
  return [...f].join('·')
}

function shuffle(arr) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]]
  }
  return arr
}

function cellBg(n) {
  if (n % 2  === 0) return 'linear-gradient(135deg,#1e3a5f,#1e4d8c)'
  if (n % 3  === 0) return 'linear-gradient(135deg,#14432a,#15693f)'
  if (n % 5  === 0) return 'linear-gradient(135deg,#4a2010,#7c3516)'
  if (n % 7  === 0) return 'linear-gradient(135deg,#2e1a47,#4c2880)'
  if (n % 11 === 0) return 'linear-gradient(135deg,#0e3040,#0d5068)'
  if (n % 13 === 0) return 'linear-gradient(135deg,#3a1a2e,#621a4a)'
  return 'linear-gradient(135deg,#252535,#343454)'
}

function cellBorder(n) {
  if (n % 2  === 0) return '#60a5fa'
  if (n % 3  === 0) return '#4ade80'
  if (n % 5  === 0) return '#fb923c'
  if (n % 7  === 0) return '#c084fc'
  if (n % 11 === 0) return '#22d3ee'
  if (n % 13 === 0) return '#f472b6'
  return '#818cf8'
}

// ── 生成棋盘（质因数成对保证理论可全消）────────────────────
function generateVals(cfg) {
  const total = cfg.cols * cfg.rows
  const vals = new Array(total).fill(1)

  function eligible(p) {
    return vals.map((_, i) => i).filter(i => vals[i] * p <= cfg.maxVal)
  }
  function pickTwo(pool, pref1) {
    const ones = pref1 ? pool.filter(i => vals[i] === 1) : []
    if (ones.length >= 2) { shuffle(ones); return [ones[0], ones[1]] }
    if (ones.length === 1) {
      const r = pool.filter(i => i !== ones[0])
      if (!r.length) return null
      return [ones[0], r[Math.floor(Math.random() * r.length)]]
    }
    if (pool.length < 2) return null
    shuffle(pool); return [pool[0], pool[1]]
  }

  let tries = 0
  while (vals.some(v => v === 1) && tries++ < 300000) {
    const p = cfg.primes[Math.floor(Math.random() * cfg.primes.length)]
    const pair = pickTwo(eligible(p), true)
    if (!pair) continue
    vals[pair[0]] *= p; vals[pair[1]] *= p
  }
  for (let k = 0; k < total; k++) {
    const p = cfg.primes[Math.floor(Math.random() * cfg.primes.length)]
    const pair = pickTwo(eligible(p), false)
    if (!pair) continue
    vals[pair[0]] *= p; vals[pair[1]] *= p
  }
  return vals
}

// ── 路径查找（≤2折，同连连看）──────────────────────────────
function makePathFinder(board, cols, rows) {
  function isEmpty(r, c) {
    if (r < 0 || r >= rows || c < 0 || c >= cols) return true
    return board[r * cols + c].empty
  }
  function checkLine(a, b) {
    if (a.r === b.r) {
      const [c0, c1] = a.c < b.c ? [a.c, b.c] : [b.c, a.c]
      for (let c = c0 + 1; c < c1; c++) if (!isEmpty(a.r, c)) return false
      return true
    }
    if (a.c === b.c) {
      const [r0, r1] = a.r < b.r ? [a.r, b.r] : [b.r, a.r]
      for (let r = r0 + 1; r < r1; r++) if (!isEmpty(r, a.c)) return false
      return true
    }
    return false
  }
  return function findPath(ia, ib) {
    const A = { r: Math.floor(ia / cols), c: ia % cols }
    const B = { r: Math.floor(ib / cols), c: ib % cols }
    if (checkLine(A, B)) return [A, B]
    const c1 = { r: A.r, c: B.c }, c2 = { r: B.r, c: A.c }
    if (isEmpty(c1.r, c1.c) && checkLine(A, c1) && checkLine(c1, B)) return [A, c1, B]
    if (isEmpty(c2.r, c2.c) && checkLine(A, c2) && checkLine(c2, B)) return [A, c2, B]
    for (let c = -1; c <= cols; c++) {
      if (c === A.c) continue
      const m = { r: A.r, c }, m2 = { r: B.r, c }
      if (!isEmpty(m.r, m.c) || !isEmpty(m2.r, m2.c)) continue
      if (checkLine(A, m) && checkLine(m, m2) && checkLine(m2, B)) return [A, m, m2, B]
    }
    for (let r = -1; r <= rows; r++) {
      if (r === A.r) continue
      const m = { r, c: A.c }, m2 = { r, c: B.c }
      if (!isEmpty(m.r, m.c) || !isEmpty(m2.r, m2.c)) continue
      if (checkLine(A, m) && checkLine(m, m2) && checkLine(m2, B)) return [A, m, m2, B]
    }
    return null
  }
}

// ── Page ──────────────────────────────────────────────────
Page({
  data: {
    diff: 1,
    cells: [],
    remaining: 0,
    timeLeft: 0,
    score: 0,
    msg: '',
    boardPx: 300,
    cellPx: 56,
    fontSize: '36rpx',
    undoStack: [],
    showPayModal: false,
  },

  _board: [],      // raw board data (不放data里，避免频繁setData卡顿)
  _cfg: null,
  _selected: null,
  _timerID: null,
  _findPath: null,
  _lineCtx: null,
  _lineCanvas: null,

  onLoad() {
    this._cfg = DIFF_CONFIG[1]
    this._initBgCanvas()
    this.newGame()
  },

  onUnload() {
    clearInterval(this._timerID)
  },

  // ── 背景粒子（简化版）──────────────────────────────────
  _initBgCanvas() {
    const query = this.createSelectorQuery()
    query.select('#bg-canvas').fields({ node: true, size: true }).exec(res => {
      if (!res[0]) return
      const canvas = res[0].node
      const ctx = canvas.getContext('2d')
      const dpr = wx.getWindowInfo().pixelRatio
      const { windowWidth: W, windowHeight: H } = wx.getWindowInfo()
      canvas.width = W * dpr; canvas.height = H * dpr
      ctx.scale(dpr, dpr)

      const ICONS = ['⭐','💫','✨','🌸','🎀','💜','🌙','💎','🍬','🎵']
      const floaters = Array.from({ length: 24 }, () => ({
        x: Math.random() * W, y: Math.random() * H,
        icon: ICONS[Math.floor(Math.random() * ICONS.length)],
        size: 10 + Math.random() * 14,
        vx: (Math.random() - .5) * .3, vy: -.15 - Math.random() * .3,
        alpha: .1 + Math.random() * .2,
      }))

      const tick = () => {
        ctx.clearRect(0, 0, W, H)
        floaters.forEach(f => {
          f.x += f.vx; f.y += f.vy
          if (f.y < -20) { f.y = H + 20; f.x = Math.random() * W }
          ctx.save()
          ctx.globalAlpha = f.alpha
          ctx.font = f.size + 'px serif'
          ctx.textAlign = 'center'; ctx.textBaseline = 'middle'
          ctx.fillText(f.icon, f.x, f.y)
          ctx.restore()
        })
      }
      const loop = () => { tick(); canvas.requestAnimationFrame(loop) }
      loop()
    })
  },

  // ── 线条画布 ────────────────────────────────────────────
  _initLineCanvas(boardPx) {
    const query = this.createSelectorQuery()
    query.select('#line-canvas').fields({ node: true, size: true }).exec(res => {
      if (!res[0]) return
      const canvas = res[0].node
      const dpr = wx.getWindowInfo().pixelRatio
      canvas.width = boardPx * dpr; canvas.height = boardPx * dpr
      const ctx = canvas.getContext('2d')
      ctx.scale(dpr, dpr)
      this._lineCtx = ctx
      this._lineCanvas = canvas
    })
  },

  _clearLine() {
    if (!this._lineCtx || !this._lineCanvas) return
    const { windowWidth: W } = wx.getWindowInfo()
    this._lineCtx.clearRect(0, 0, W, W)
  },

  _drawPath(path, cellPx, gap, pad) {
    if (!this._lineCtx) return
    this._clearLine()
    const ctx = this._lineCtx
    ctx.strokeStyle = '#fde68a'; ctx.lineWidth = 3
    ctx.lineCap = 'round'; ctx.lineJoin = 'round'
    ctx.shadowColor = '#fde68a'; ctx.shadowBlur = 10
    ctx.beginPath()
    path.forEach((p, i) => {
      const x = pad + p.c * (cellPx + gap) + cellPx / 2
      const y = pad + p.r * (cellPx + gap) + cellPx / 2
      i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y)
    })
    ctx.stroke(); ctx.shadowBlur = 0
  },

  // ── 难度切换 ────────────────────────────────────────────
  setDiff(e) {
    const d = +e.currentTarget.dataset.d
    if (DIFF_CONFIG[d].paid && !this._unlocked) {
      this.setData({ showPayModal: true, pendingDiff: d })
      return
    }
    this._cfg = DIFF_CONFIG[d]
    this.setData({ diff: d })
    this.newGame()
  },

  // ── 微信支付 ────────────────────────────────────────────
  doPay() {
    // 从你的服务器获取 prepay_id，调起微信支付
    // 注意：需要自己搭建后端接口，这里是示例框架
    wx.showLoading({ title: '拉起支付...' })

    // TODO: 替换为你自己的后端接口地址
    wx.request({
      url: 'https://your-server.com/api/create-order',
      method: 'POST',
      data: { product: 'unlock_advanced', price: 600 }, // 单位：分
      success: res => {
        wx.hideLoading()
        const { timeStamp, nonceStr, prepay_id, paySign } = res.data
        wx.requestPayment({
          timeStamp, nonceStr,
          package: `prepay_id=${prepay_id}`,
          signType: 'RSA',
          paySign,
          success: () => {
            this._unlocked = true
            wx.setStorageSync('unlocked', true)
            this.setData({ showPayModal: false })
            this._cfg = DIFF_CONFIG[this.data.pendingDiff]
            this.setData({ diff: this.data.pendingDiff })
            this.newGame()
          },
          fail: () => wx.showToast({ title: '支付取消', icon: 'none' }),
        })
      },
      fail: () => {
        wx.hideLoading()
        wx.showToast({ title: '网络错误', icon: 'none' })
      }
    })
  },

  cancelPay() { this.setData({ showPayModal: false }) },

  // ── 新游戏 ──────────────────────────────────────────────
  newGame() {
    clearInterval(this._timerID)
    this._selected = null
    this._unlocked = wx.getStorageSync('unlocked') || false

    const cfg = this._cfg
    const { windowWidth } = wx.getWindowInfo()

    // 计算格子尺寸（适配屏幕）
    const boardPx = Math.min(windowWidth - 32, 420)
    const cellPx = Math.floor((boardPx - PAD * 2 - GAP * (cfg.cols - 1)) / cfg.cols)
    const realBoardPx = PAD * 2 + cellPx * cfg.cols + GAP * (cfg.cols - 1)
    const fontSize = cellPx > 60 ? '38rpx' : cellPx > 50 ? '32rpx' : '26rpx'

    const vals = generateVals(cfg)
    this._board = vals.map(v => ({
      val: v, empty: v === 1,
      bg: cellBg(v), border: cellBorder(v),
      pf: uniquePF(v),
      selected: false, hint: false,
    }))

    const remaining = this._board.filter(c => !c.empty).length
    this._findPath = makePathFinder(this._board, cfg.cols, cfg.rows)

    this.setData({
      cells: [...this._board],
      remaining, score: 0,
      timeLeft: cfg.timeLimit,
      msg: '', boardPx: realBoardPx, cellPx, fontSize,
      undoStack: [],
    })

    this._initLineCanvas(realBoardPx)
    this._startTimer()
  },

  // ── 计时器 ──────────────────────────────────────────────
  _startTimer() {
    clearInterval(this._timerID)
    this._timerID = setInterval(() => {
      const t = this.data.timeLeft - 1
      this.setData({ timeLeft: t })
      if (t <= 0) {
        clearInterval(this._timerID)
        this.setData({ msg: '⏰ 时间到！游戏结束' })
      }
    }, 1000)
  },

  // ── 点击格子 ────────────────────────────────────────────
  onCellTap(e) {
    if (this.data.timeLeft <= 0) return
    const i = +e.currentTarget.dataset.i
    if (this._board[i].empty) return

    const cfg = this._cfg
    this._clearHint()

    if (this._selected === null) {
      this._selected = i
      this._board[i].selected = true
      this.setData({ [`cells[${i}].selected`]: true })
      return
    }

    if (this._selected === i) {
      this._board[i].selected = false
      this.setData({ [`cells[${i}].selected`]: false })
      this._selected = null
      return
    }

    const ia = this._selected, ib = i
    const g = gcd(this._board[ia].val, this._board[ib].val)

    if (g === 1) {
      this._flashError(ia, ib)
      return
    }

    const path = this._findPath(ia, ib)
    if (!path) {
      this._flashError(ia, ib)
      return
    }

    // 有效操作
    this._pushUndo()
    this._selected = null
    this._board[ia].selected = false
    this._board[ib].selected = false

    this._drawPath(path, this.data.cellPx, GAP, PAD)

    const newA = this._board[ia].val / g
    const newB = this._board[ib].val / g

    setTimeout(() => {
      this._clearLine()
      this._applyMove(ia, newA, ib, newB, g)
    }, 420)
  },

  _applyMove(ia, newA, ib, newB, g) {
    let pts = 10, remaining = this.data.remaining
    const updates = {}

    const applyOne = (idx, nv) => {
      if (nv === 1) {
        this._board[idx] = { ...this._board[idx], empty: true, val: 1 }
        updates[`cells[${idx}]`] = { ...this._board[idx] }
        remaining--; pts += 20
        wx.vibrateShort({ type: 'medium' })
      } else {
        this._board[idx] = {
          ...this._board[idx],
          val: nv, bg: cellBg(nv),
          border: cellBorder(nv), pf: uniquePF(nv),
        }
        updates[`cells[${idx}]`] = { ...this._board[idx] }
        pts += 5
        wx.vibrateShort({ type: 'light' })
      }
    }

    applyOne(ia, newA); applyOne(ib, newB)
    this._findPath = makePathFinder(this._board, this._cfg.cols, this._cfg.rows)

    const score = this.data.score + pts
    this.setData({ ...updates, remaining, score, msg: `÷ ${g}` })
    setTimeout(() => this.setData({ msg: '' }), 800)

    if (remaining === 0) {
      clearInterval(this._timerID)
      const final = score + this.data.timeLeft * 3
      this.setData({ score: final, msg: `🎉 全部消除！得分: ${final}` })
    } else if (!this._findAnyPair()) {
      this.setData({ msg: '⚠️ 暂无可消的对，试试重排或悔棋' })
    }
  },

  // ── 悔棋 ────────────────────────────────────────────────
  _pushUndo() {
    const stack = [...this.data.undoStack, this._board.map(c => ({ ...c }))]
    if (stack.length > MAX_UNDO) stack.shift()
    this.setData({ undoStack: stack })
  },

  doUndo() {
    const stack = [...this.data.undoStack]
    if (!stack.length) return
    this._clearHint()
    if (this._selected !== null) {
      this._board[this._selected].selected = false
      this._selected = null
    }
    this._board = stack.pop()
    this._findPath = makePathFinder(this._board, this._cfg.cols, this._cfg.rows)
    const remaining = this._board.filter(c => !c.empty).length
    this.setData({ cells: [...this._board], remaining, undoStack: stack, msg: '' })
  },

  // ── 提示 ────────────────────────────────────────────────
  showHint() {
    this._clearHint()
    const pair = this._findAnyPair()
    if (!pair) { this.setData({ msg: '⚠️ 没有有效对，请重排' }); return }
    const g = gcd(this._board[pair[0]].val, this._board[pair[1]].val)
    this._board[pair[0]].hint = true; this._board[pair[1]].hint = true
    this.setData({
      [`cells[${pair[0]}].hint`]: true,
      [`cells[${pair[1]}].hint`]: true,
      msg: `💡 ${this._board[pair[0]].val} 与 ${this._board[pair[1]].val}，公约数=${g}`,
    })
    this._drawPath(pair[2], this.data.cellPx, GAP, PAD)
    this._hintTO = setTimeout(() => this._clearHint(), 2800)
  },

  _clearHint() {
    clearTimeout(this._hintTO)
    this._clearLine()
    this._board.forEach((c, i) => {
      if (c.hint) {
        this._board[i].hint = false
        this.setData({ [`cells[${i}].hint`]: false })
      }
    })
    this.setData({ msg: '' })
  },

  _findAnyPair() {
    const alive = this._board.map((c, i) => i).filter(i => !this._board[i].empty)
    for (let x = 0; x < alive.length; x++) {
      for (let y = x + 1; y < alive.length; y++) {
        const ia = alive[x], ib = alive[y]
        if (gcd(this._board[ia].val, this._board[ib].val) > 1) {
          const path = this._findPath(ia, ib)
          if (path) return [ia, ib, path]
        }
      }
    }
    return null
  },

  // ── 重排 ────────────────────────────────────────────────
  shuffleBoard() {
    this._clearHint()
    if (this._selected !== null) {
      this._board[this._selected].selected = false
      this._selected = null
    }
    const alive = this._board.map((c, i) => i).filter(i => !this._board[i].empty)
    const vals = shuffle(alive.map(i => this._board[i].val))
    alive.forEach((i, k) => {
      const v = vals[k]
      this._board[i] = { ...this._board[i], val: v, bg: cellBg(v), border: cellBorder(v), pf: uniquePF(v) }
    })
    this._findPath = makePathFinder(this._board, this._cfg.cols, this._cfg.rows)
    this.setData({ cells: [...this._board], msg: '🔀 已重排！' })
    setTimeout(() => this.setData({ msg: '' }), 1400)
  },

  // ── 错误提示 ────────────────────────────────────────────
  _flashError(ia, ib) {
    wx.vibrateShort({ type: 'heavy' })
    this._board[ia].selected = false
    this.setData({
      [`cells[${ia}].selected`]: false,
      msg: gcd(this._board[ia].val, this._board[ib].val) === 1
        ? '❌ 两数互质，无法消除' : '❌ 路径被阻断',
    })
    this._selected = null
    setTimeout(() => this.setData({ msg: '' }), 1000)
  },
})
