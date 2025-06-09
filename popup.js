const siteInput = document.getElementById('siteInput')
const minutesInput = document.getElementById('minutesInput')
const siteList = document.getElementById('siteList')

// Charger et afficher les sites bloqués
function loadBlockedSites() {
  chrome.storage.local.get('blockedSites', (data) => {
    console.log('loadBlockedSites - data reçue:', data)
    let sites = data.blockedSites || []

    // MIGRATION : Convertir ancien format (array) vers nouveau format (object)
    if (Array.isArray(sites)) {
      console.log('Migration du format array vers object')
      const newFormat = {}
      sites.forEach((site) => {
        newFormat[site] = 300000 // 5 minutes par défaut pour les anciens sites
      })
      sites = newFormat
      // Sauvegarder le nouveau format
      chrome.storage.local.set({ blockedSites: sites })
    }

    console.log('Sites à afficher:', sites)
    displaySites(sites)
  })
}

// Afficher les sites dans la liste
function displaySites(sites) {
  siteList.innerHTML = ''

  if (Object.keys(sites).length === 0) {
    siteList.innerHTML = '<div class="no-sites">Aucun site bloqué</div>'
    siteList.style.overflowY = 'hidden'
    return
  }

  Object.entries(sites).forEach(([site, limitMs]) => {
    const limitMinutes = Math.round(limitMs / 60000)
    const siteItem = document.createElement('div')
    siteItem.className = 'site-item'
    siteItem.innerHTML = `
      <span><strong>${site}</strong> - ${limitMinutes} min</span>
      <button class="remove-btn" data-site="${site}">✕</button>
    `
    siteList.appendChild(siteItem)
  })

  // Gérer intelligemment le scroll selon le nombre d'éléments
  const itemCount = Object.keys(sites).length
  if (itemCount <= 2) {
    siteList.style.overflowY = 'hidden'
  } else {
    siteList.style.overflowY = 'auto'
  }

  // Ajouter les event listeners pour les boutons de suppression
  document.querySelectorAll('.remove-btn').forEach((btn) => {
    btn.addEventListener('click', (e) => {
      const siteToRemove = e.target.getAttribute('data-site')
      removeSite(siteToRemove)
    })
  })
}

// Fonction pour créer et afficher une toast notification
function showToast(message, type = 'success') {
  // Supprimer les toasts existantes
  const existingToast = document.querySelector('.toast')
  if (existingToast) {
    existingToast.remove()
  }

  // Créer la nouvelle toast
  const toast = document.createElement('div')
  toast.className = `toast ${type}`

  // Ajouter une icône selon le type
  const icon = type === 'success' ? '✓' : type === 'error' ? '✗' : '⚠'
  toast.innerHTML = `<span style="font-weight: bold;">${icon}</span><span>${message}</span>`

  // Ajouter au body
  document.body.appendChild(toast)

  // Animation d'entrée
  setTimeout(() => toast.classList.add('show'), 10)

  // Animation de sortie et suppression
  setTimeout(() => {
    toast.classList.remove('show')
    setTimeout(() => toast.remove(), 300) // Temps de l'animation de sortie
  }, 4000) // Durée d'affichage du message
}

// Ajouter un nouveau site
function addSite(site, minutes) {
  if (!site || site.trim() === '') {
    showToast('Veuillez entrer un nom de domaine', 'error')
    return
  }

  if (!minutes || minutes < 1) {
    showToast('Durée minimum : 1 minute', 'error')
    return
  }

  // Nettoyer le domaine (enlever http/https et www)
  site = site.trim().toLowerCase()
  site = site.replace(/^https?:\/\//, '')
  site = site.replace(/^www\./, '')
  site = site.split('/')[0] // Prendre seulement le domaine

  const limitMs = minutes * 60 * 1000

  chrome.storage.local.get('blockedSites', (data) => {
    let sites = data.blockedSites || {}

    // Assurer la compatibilité avec l'ancien format
    if (Array.isArray(sites)) {
      const newFormat = {}
      sites.forEach((s) => {
        newFormat[s] = 300000 // 5 minutes par défaut
      })
      sites = newFormat
    }

    if (sites[site]) {
      showToast('Site déjà dans la liste', 'warning')
      return
    }

    sites[site] = limitMs
    chrome.storage.local.set({ blockedSites: sites }, () => {
      // NETTOYAGE PRÉVENTIF: S'assurer qu'il n'y a pas de données résiduelles
      const blockedKey = `scrollBlocked_${site}`
      const timeKey = `scrollTime_${site}`
      chrome.storage.local.remove([blockedKey, timeKey], () => {
        showToast(`${site} ajouté (${minutes} min) - Rechargez la page ${site}`, 'success')
        siteInput.value = ''
        minutesInput.value = 5
        console.log(`Site ${site} ajouté et données (${blockedKey}, ${timeKey}) nettoyées`)
        loadBlockedSites()
      })
    })
  })
}

// Supprimer un site
function removeSite(site) {
  chrome.storage.local.get('blockedSites', (data) => {
    let sites = data.blockedSites || {}

    // Assurer la compatibilité avec l'ancien format
    if (Array.isArray(sites)) {
      const newFormat = {}
      sites.forEach((s) => {
        newFormat[s] = 300000
      })
      sites = newFormat
    }

    delete sites[site]

    chrome.storage.local.set({ blockedSites: sites }, () => {
      // FORCER À FALSE au lieu de supprimer
      const blockedKey = `scrollBlocked_${site}`
      const timeKey = `scrollTime_${site}`
      chrome.storage.local.set({ [blockedKey]: false }, () => {
        chrome.storage.local.remove(timeKey, () => {
          showToast(`${site} supprimé - Débloqué automatiquement`, 'success')
          console.log(`Site ${site} supprimé, ${blockedKey} forcé à FALSE, ${timeKey} supprimé`)
          loadBlockedSites()
        })
      })
    })
  })
}

// Event listeners
document.getElementById('addSite').addEventListener('click', () => {
  const site = siteInput.value
  const minutes = parseInt(minutesInput.value)
  addSite(site, minutes)
})

// Permettre d'ajouter un site en appuyant sur Entrée
siteInput.addEventListener('keypress', (e) => {
  if (e.key === 'Enter') {
    const site = siteInput.value
    const minutes = parseInt(minutesInput.value)
    addSite(site, minutes)
  }
})

minutesInput.addEventListener('keypress', (e) => {
  if (e.key === 'Enter') {
    const site = siteInput.value
    const minutes = parseInt(minutesInput.value)
    addSite(site, minutes)
  }
})

// Charger les sites au démarrage
loadBlockedSites()
