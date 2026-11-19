const OPEN = '<think>'
const CLOSE = '</think>'

function longestSuffixThatIsPrefix(text, tag) {
  const max = Math.min(tag.length - 1, text.length)
  for (let i = max; i > 0; i -= 1) {
    if (text.endsWith(tag.slice(0, i))) return i
  }
  return 0
}

/**
 * 兼容第三方网关用 <think>...</think> 包裹思考过程的兜底过滤器。
 * 官方 DeepSeek V4 使用 reasoning_content，不经过这里。
 */
export function createThinkFilter() {
  let inThink = false
  let pending = ''

  return {
    push(text) {
      pending += text || ''
      const out = { content: '', thinking: '' }
      while (pending) {
        const tag = inThink ? CLOSE : OPEN
        const index = pending.indexOf(tag)
        if (index < 0) {
          const keep = longestSuffixThatIsPrefix(pending, tag)
          const emit = keep ? pending.slice(0, pending.length - keep) : pending
          if (inThink) out.thinking += emit
          else out.content += emit
          pending = keep ? pending.slice(pending.length - keep) : ''
          break
        }
        const before = pending.slice(0, index)
        if (inThink) out.thinking += before
        else out.content += before
        pending = pending.slice(index + tag.length)
        inThink = !inThink
      }
      return out
    },
    flush() {
      const out = inThink ? { content: '', thinking: pending } : { content: pending, thinking: '' }
      pending = ''
      return out
    }
  }
}
