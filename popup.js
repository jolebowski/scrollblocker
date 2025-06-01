const input = document.getElementById('minutes')
const status = document.getElementById('status')

// Charger la valeur actuelle
chrome.storage.local.get('scrollTimeLimit', (data) => {
  const ms = data.scrollTimeLimit ?? 60000
  input.value = ms / 60000
  console.log(`Valeur chargée depuis chrome.storage : ${ms} ms`)
})

document.getElementById('save').addEventListener('click', () => {
  const mins = parseInt(input.value)
  const ms = mins * 60 * 1000
  chrome.storage.local.set({ scrollTimeLimit: ms }, () => {
    chrome.storage.local.remove('scrollBlocked')
    console.log(`Nouvelle valeur enregistrée : ${ms} ms`)
    status.textContent = `Limite définie à ${mins} minute(s)`
  })
})
