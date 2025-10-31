/**
 * FRONTEND INTEGRATION EXAMPLE
 * 
 * Dit bestand toont hoe je de server-side deleted addresses sync kunt integreren
 * in de checkout page. Kopieer en pas de relevante delen aan in:
 * web/src/app/checkout/page.tsx
 */

// ==========================================
// STAP 1: Nieuwe State Toevoegen
// ==========================================

// Voeg toe aan de component state (rond regel 200):
const [deletedAddressesServer, setDeletedAddressesServer] = useState<string[]>([]);
const [isSyncingAddresses, setIsSyncingAddresses] = useState(false);

// ==========================================
// STAP 2: Fetch Deleted Addresses on Mount
// ==========================================

/**
 * Fetch deleted addresses from server when user logs in
 * This syncs the server-side list with localStorage
 */
useEffect(() => {
  const fetchDeletedAddressesFromServer = async () => {
    if (!isLoggedIn || !user?.email) return;
    
    setIsSyncingAddresses(true);
    
    try {
      console.log('🔄 Fetching deleted addresses from server for:', user.email);
      
      const response = await fetch(
        `/api/woocommerce/customer/deleted-addresses?email=${encodeURIComponent(user.email)}`
      );
      
      if (response.ok) {
        const data = await response.json();
        
        if (data.success && data.data?.deletedAddresses) {
          const serverDeleted = data.data.deletedAddresses;
          console.log('✅ Server deleted addresses:', serverDeleted);
          
          setDeletedAddressesServer(serverDeleted);
          
          // Merge with localStorage (union of both lists)
          const localDeleted = JSON.parse(
            localStorage.getItem('deletedAddresses') || '[]'
          );
          
          // Create union of server and local deleted addresses
          const merged = [...new Set([...localDeleted, ...serverDeleted])];
          
          console.log('🔀 Merged deleted addresses:', merged);
          
          // Update localStorage with merged list
          localStorage.setItem('deletedAddresses', JSON.stringify(merged));
          
          // If there were local-only deletions, sync them to server
          const localOnly = localDeleted.filter((id: string) => !serverDeleted.includes(id));
          if (localOnly.length > 0) {
            console.log('📤 Syncing local-only deletions to server:', localOnly);
            
            // Sync each local-only deletion to server
            for (const addressId of localOnly) {
              await syncDeleteToServer(user.email, addressId);
            }
          }
          
          // Trigger refresh to filter addresses
          setAddressRefresh(prev => prev + 1);
        }
      } else {
        console.warn('⚠️ Failed to fetch deleted addresses from server, using localStorage only');
      }
    } catch (error) {
      console.error('❌ Error fetching deleted addresses from server:', error);
      // Graceful degradation: continue with localStorage only
    } finally {
      setIsSyncingAddresses(false);
    }
  };
  
  fetchDeletedAddressesFromServer();
}, [isLoggedIn, user?.email]);

// ==========================================
// STAP 3: Helper Function voor Server Sync
// ==========================================

/**
 * Sync a deleted address to the server
 */
const syncDeleteToServer = async (email: string, addressId: string): Promise<boolean> => {
  try {
    const response = await fetch('/api/woocommerce/customer/address/delete', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        email,
        addressId,
      }),
    });
    
    if (response.ok) {
      const data = await response.json();
      console.log('✅ Synced deletion to server:', addressId);
      
      // Update server state
      if (data.data?.deletedAddresses) {
        setDeletedAddressesServer(data.data.deletedAddresses);
      }
      
      return true;
    }
    
    console.warn('⚠️ Failed to sync deletion to server:', addressId);
    return false;
  } catch (error) {
    console.error('❌ Error syncing deletion to server:', error);
    return false;
  }
};

// ==========================================
// STAP 4: Updated Delete Handler (Hybrid)
// ==========================================

/**
 * OPTIE A: HYBRID APPROACH (Instant feedback + Server sync)
 * Beste van beide werelden: Instant UI update + Cross-device sync
 */
const handleDeleteAddressHybrid = async (addressId: string) => {
  console.log('🗑️ Deleting address:', addressId);
  
  // 1. INSTANT LOCAL UPDATE (voor immediate UI feedback)
  const deletedAddresses = JSON.parse(
    localStorage.getItem('deletedAddresses') || '[]'
  );
  
  if (!deletedAddresses.includes(addressId)) {
    deletedAddresses.push(addressId);
    localStorage.setItem('deletedAddresses', JSON.stringify(deletedAddresses));
    console.log('💾 Updated localStorage:', deletedAddresses);
  }
  
  // Update UI immediately
  setPreviousAddresses(prev => prev.filter(addr => addr.id !== addressId));
  
  // Clear selection if this address was selected
  if (formData.selectedAddressId === addressId) {
    setFormData(prev => ({
      ...prev,
      selectedAddressId: '',
      billingAddress: '',
      billingHouseNumber: '',
      billingHouseAddition: '',
      billingCity: '',
      billingPostcode: '',
      billingCountry: 'NL',
    }));
  }
  
  // Trigger refresh
  setAddressRefresh(prev => prev + 1);
  
  // 2. BACKGROUND SERVER SYNC (voor cross-device sync)
  if (user?.email) {
    const success = await syncDeleteToServer(user.email, addressId);
    
    if (success) {
      console.log('✅ Address deleted and synced to server');
    } else {
      console.warn('⚠️ Address deleted locally, but server sync failed');
      // UI already updated, so no error to user
    }
  } else {
    console.warn('⚠️ No user email, deletion is local-only');
  }
};

// ==========================================
// STAP 5: Alternative - Server-First Approach
// ==========================================

/**
 * OPTIE B: SERVER-FIRST APPROACH (Most reliable)
 * Wacht op server bevestiging voordat UI update
 */
const handleDeleteAddressServerFirst = async (addressId: string) => {
  if (!user?.email) {
    // Not logged in - use localStorage only
    const deletedAddresses = JSON.parse(
      localStorage.getItem('deletedAddresses') || '[]'
    );
    deletedAddresses.push(addressId);
    localStorage.setItem('deletedAddresses', JSON.stringify(deletedAddresses));
    
    setPreviousAddresses(prev => prev.filter(addr => addr.id !== addressId));
    setAddressRefresh(prev => prev + 1);
    return;
  }
  
  // Show loading state
  setIsSyncingAddresses(true);
  
  try {
    const response = await fetch('/api/woocommerce/customer/address/delete', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        email: user.email,
        addressId: addressId,
      }),
    });
    
    if (response.ok) {
      const data = await response.json();
      
      // Update server state
      if (data.data?.deletedAddresses) {
        setDeletedAddressesServer(data.data.deletedAddresses);
        
        // Update localStorage to match server
        localStorage.setItem(
          'deletedAddresses',
          JSON.stringify(data.data.deletedAddresses)
        );
      }
      
      // Update UI after server confirmation
      setPreviousAddresses(prev => prev.filter(addr => addr.id !== addressId));
      
      if (formData.selectedAddressId === addressId) {
        setFormData(prev => ({
          ...prev,
          selectedAddressId: '',
          billingAddress: '',
          billingHouseNumber: '',
          billingHouseAddition: '',
          billingCity: '',
          billingPostcode: '',
          billingCountry: 'NL',
        }));
      }
      
      setAddressRefresh(prev => prev + 1);
      
      console.log('✅ Address deleted successfully from server');
    } else {
      console.error('❌ Failed to delete address from server');
      alert('Kon adres niet verwijderen. Probeer het opnieuw.');
    }
  } catch (error) {
    console.error('🚨 Error deleting address:', error);
    alert('Er ging iets mis bij het verwijderen. Probeer het opnieuw.');
  } finally {
    setIsSyncingAddresses(false);
  }
};

// ==========================================
// STAP 6: UI Loading Indicator (Optioneel)
// ==========================================

/**
 * Voeg loading indicator toe aan de UI
 * Plaats dit in de JSX waar addresses worden getoond
 */
const LoadingIndicator = () => {
  if (!isSyncingAddresses) return null;
  
  return (
    <div className="flex items-center gap-2 text-sm text-gray-600 mb-4">
      <svg 
        className="animate-spin h-4 w-4 text-[#814e1e]" 
        xmlns="http://www.w3.org/2000/svg" 
        fill="none" 
        viewBox="0 0 24 24"
      >
        <circle 
          className="opacity-25" 
          cx="12" 
          cy="12" 
          r="10" 
          stroke="currentColor" 
          strokeWidth="4"
        />
        <path 
          className="opacity-75" 
          fill="currentColor" 
          d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
        />
      </svg>
      <span>Adressen synchroniseren...</span>
    </div>
  );
};

// ==========================================
// STAP 7: Sync Status Badge (Optioneel)
// ==========================================

/**
 * Toon sync status in de UI
 */
const SyncStatusBadge = () => {
  const hasServerData = deletedAddressesServer.length > 0;
  const isOnline = typeof navigator !== 'undefined' && navigator.onLine;
  
  return (
    <div className="flex items-center gap-2 text-xs">
      {isSyncingAddresses ? (
        <>
          <span className="inline-block w-2 h-2 bg-yellow-500 rounded-full animate-pulse"></span>
          <span className="text-gray-600">Synchroniseren...</span>
        </>
      ) : hasServerData && isOnline ? (
        <>
          <span className="inline-block w-2 h-2 bg-green-500 rounded-full"></span>
          <span className="text-gray-600">Gesynchroniseerd</span>
        </>
      ) : !isOnline ? (
        <>
          <span className="inline-block w-2 h-2 bg-gray-400 rounded-full"></span>
          <span className="text-gray-600">Offline</span>
        </>
      ) : (
        <>
          <span className="inline-block w-2 h-2 bg-blue-500 rounded-full"></span>
          <span className="text-gray-600">Lokaal opgeslagen</span>
        </>
      )}
    </div>
  );
};

// ==========================================
// STAP 8: Export Aanbevolen Aanpak
// ==========================================

/**
 * AANBEVELING:
 * 
 * Gebruik de HYBRID APPROACH (handleDeleteAddressHybrid) omdat dit:
 * ✅ Instant UI feedback geeft (goede UX)
 * ✅ Cross-device sync biedt (als server beschikbaar)
 * ✅ Blijft werken bij server issues (graceful degradation)
 * ✅ Automatisch local + server merget bij login
 * 
 * IMPLEMENTATIE STAPPEN:
 * 1. Kopieer de nieuwe state variables (deletedAddressesServer, isSyncingAddresses)
 * 2. Kopieer de fetch useEffect voor server sync
 * 3. Kopieer de syncDeleteToServer helper function
 * 4. Vervang handleDeleteAddress met handleDeleteAddressHybrid
 * 5. (Optioneel) Voeg LoadingIndicator en SyncStatusBadge toe aan UI
 * 
 * BELANGRIJK:
 * - Test eerst op development/staging
 * - Zorg dat WordPress plugin geïnstalleerd en actief is
 * - Verifieer dat API endpoints werken met cURL/Postman
 * - Monitor console logs voor sync issues
 */

export {
  handleDeleteAddressHybrid,
  handleDeleteAddressServerFirst,
  syncDeleteToServer,
  LoadingIndicator,
  SyncStatusBadge,
};

