import Resource from './Resource.js'

class Cover extends Resource {
    constructor(id, name, x, y) {
        super(id, name, x, y)
        this.subtype = 'cover'
        this.tags.add('cover')
        this.color = '#228B22'  // Forest green
        this.size = 15
        this.capacity = 3       // How many animals can hide here
        this.currentOccupants = 0
        this.securityValue = 70 // How much security this provides (0-100)
    }
    
    // Check if there's room for more occupants
    hasSpace() {
        return this.currentOccupants < this.capacity
    }
    
    // Enter cover (returns true if successful)
    enter() {
        if (!this.hasSpace()) return false
        
        this.currentOccupants++
        return true
    }
    
    // Leave cover
    leave() {
        if (this.currentOccupants > 0) {
            this.currentOccupants--
        }
    }
}

export default Cover
