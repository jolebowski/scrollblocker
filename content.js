let scrollStart = Date.now()
let totalTime = 0
let timer
let hasBlocked = false
let scrollLimit = 60000 // fallback

chrome.storage.local.get(['scrollTimeLimit', 'scrollBlocked'], (data) => {
  if (data.scrollBlocked === true) {
    bloquerPage()
    return
  }

  if (data.scrollTimeLimit) {
    scrollLimit = parseInt(data.scrollTimeLimit)
    console.log(`Scroll limit depuis chrome.storage : ${scrollLimit}ms`)
  }

  window.addEventListener('scroll', checkScrollDuration)
})

function checkScrollDuration() {
  clearTimeout(timer)
  timer = setTimeout(() => {
    const now = Date.now()
    const sessionTime = now - scrollStart
    totalTime += sessionTime

    console.log(`Scroll total : ${totalTime}ms / Limite : ${scrollLimit}ms`)

    if (totalTime >= scrollLimit && !hasBlocked) {
      hasBlocked = true
      chrome.storage.local.set({ scrollBlocked: true })
      alert('Tu as scrollé trop longtemps. Fais une pause !')
      bloquerPage()
    } else {
      scrollStart = now
    }
  }, 1000)
}

function bloquerPage() {
  document.body.innerHTML = `
    <div style="text-align:center; margin-top:20%; font-size: 24px;">
      <p>🚫 <strong>Temps écoulé. Reviens plus tard.</strong></p>
    </div>
  `
}
