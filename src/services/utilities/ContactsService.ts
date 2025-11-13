import * as Contacts from 'expo-contacts';
import { CreatePersonDetailData } from '../data/PersonDetailsService';

export interface DeviceContact {
  id: string;
  name: string;
  phoneNumbers: string[];
  company?: string;
  jobTitle?: string;
  emails?: string[];
  selected?: boolean;
}

export interface ContactsPermissionStatus {
  granted: boolean;
  status: Contacts.PermissionStatus;
  canAskAgain: boolean;
}

class ContactsService {
  /**
   * Request permission to access contacts
   */
  async requestContactsPermission(): Promise<ContactsPermissionStatus> {
    try {
      const { status, granted, canAskAgain } = await Contacts.requestPermissionsAsync();
      
      return {
        granted,
        status,
        canAskAgain,
      };
    } catch (error) {
      console.error('Error requesting contacts permission:', error);
      return {
        granted: false,
        status: Contacts.PermissionStatus.DENIED,
        canAskAgain: false,
      };
    }
  }

  /**
   * Get permission status without requesting
   */
  async getContactsPermissionStatus(): Promise<ContactsPermissionStatus> {
    try {
      const { status, granted, canAskAgain } = await Contacts.getPermissionsAsync();
      
      return {
        granted,
        status,
        canAskAgain,
      };
    } catch (error) {
      console.error('Error getting contacts permission status:', error);
      return {
        granted: false,
        status: Contacts.PermissionStatus.DENIED,
        canAskAgain: false,
      };
    }
  }

  /**
   * Fetch all contacts from device with proper fields
   */
  async fetchDeviceContacts(): Promise<DeviceContact[]> {
    try {
      const permissionStatus = await this.getContactsPermissionStatus();
      if (!permissionStatus.granted) {
        throw new Error('Contacts permission not granted');
      }

      const { data } = await Contacts.getContactsAsync({
        fields: [
          Contacts.Fields.ID,
          Contacts.Fields.Name,
          Contacts.Fields.FirstName,
          Contacts.Fields.LastName,
          Contacts.Fields.PhoneNumbers,
          Contacts.Fields.Company,
          Contacts.Fields.JobTitle,
          Contacts.Fields.Emails,
        ],
        sort: Contacts.SortTypes.FirstName,
      });

      const contacts: DeviceContact[] = data
        .filter(contact => {
          // Only include contacts with name and phone number
          const hasName = contact.name || (contact.firstName || contact.lastName);
          const hasPhoneNumber = contact.phoneNumbers && contact.phoneNumbers.length > 0;
          return hasName && hasPhoneNumber;
        })
        .map(contact => {
          // Extract phone numbers and clean them
          const phoneNumbers = (contact.phoneNumbers || [])
            .map(phone => phone.number)
            .filter(Boolean)
            .map(number => this.cleanPhoneNumber(number));

          // Create display name
          const name = contact.name || 
                      `${contact.firstName || ''} ${contact.lastName || ''}`.trim() ||
                      'Unknown';

          return {
            id: contact.id || `temp-${Date.now()}-${Math.random()}`,
            name: name,
            phoneNumbers: phoneNumbers,
            company: contact.company || undefined,
            jobTitle: contact.jobTitle || undefined,
            emails: (contact.emails || []).map(email => email.email).filter(Boolean),
            selected: false,
          };
        })
        .filter(contact => contact.phoneNumbers.length > 0); // Final filter for phone numbers

      console.log('Fetched contacts:', contacts.length);
      return contacts;
    } catch (error) {
      console.error('Error fetching contacts:', error);
      throw error;
    }
  }

  /**
   * Search contacts by name or phone number
   */
  searchContacts(contacts: DeviceContact[], searchTerm: string): DeviceContact[] {
    if (!searchTerm.trim()) return contacts;

    const searchLower = searchTerm.toLowerCase();
    return contacts.filter(contact => 
      contact.name.toLowerCase().includes(searchLower) ||
      contact.company?.toLowerCase().includes(searchLower) ||
      contact.phoneNumbers.some(phone => 
        phone.replace(/\D/g, '').includes(searchTerm.replace(/\D/g, ''))
      )
    );
  }

  /**
   * Convert device contact to PersonDetail format
   */
  convertContactToPersonDetail(contact: DeviceContact, selectedPhoneIndex: number = 0): CreatePersonDetailData {
    const phoneNumber = contact.phoneNumbers[selectedPhoneIndex] || contact.phoneNumbers[0] || '';
    
    return {
      personName: contact.name,
      businessName: contact.company || contact.jobTitle || 'N/A',
      phoneNumber: phoneNumber,
    };
  }

  /**
   * Convert multiple contacts to PersonDetail format
   */
  convertContactsToPersonDetails(contacts: DeviceContact[]): CreatePersonDetailData[] {
    return contacts
      .filter(contact => contact.selected && contact.phoneNumbers.length > 0)
      .map(contact => this.convertContactToPersonDetail(contact));
  }

  /**
   * Clean and format phone number
   */
  private cleanPhoneNumber(phoneNumber: string): string {
    if (!phoneNumber) return '';
    
    // Remove all non-digit characters except + at the beginning
    let cleaned = phoneNumber.replace(/[^\d+]/g, '');
    
    // If it starts with +91, keep it as is
    if (cleaned.startsWith('+91')) {
      return cleaned;
    }
    
    // If it starts with 91 and is 12 digits, add +
    if (cleaned.startsWith('91') && cleaned.length === 12) {
      return '+' + cleaned;
    }
    
    // If it's 10 digits and starts with 6-9, add +91
    if (cleaned.length === 10 && /^[6-9]/.test(cleaned)) {
      return '+91' + cleaned;
    }
    
    // If it starts with 0 (landline format), remove the 0 and add +91 if it becomes valid mobile
    if (cleaned.startsWith('0') && cleaned.length === 11) {
      const withoutZero = cleaned.substring(1);
      if (/^[6-9]/.test(withoutZero)) {
        return '+91' + withoutZero;
      }
    }
    
    // Return as is if no pattern matches
    return cleaned;
  }

  /**
   * Get contacts with valid Indian mobile numbers only
   */
  filterContactsWithValidMobileNumbers(contacts: DeviceContact[]): DeviceContact[] {
    return contacts.filter(contact => {
      // Check if any phone number is a valid Indian mobile number
      return contact.phoneNumbers.some(phone => {
        const cleaned = phone.replace(/\D/g, '');
        // Check for 10-digit numbers starting with 6-9, or 12-digit numbers starting with 91
        return /^[6-9]\d{9}$/.test(cleaned) || /^91[6-9]\d{9}$/.test(cleaned);
      });
    }).map(contact => ({
      ...contact,
      // Filter phone numbers to only include valid Indian mobile numbers
      phoneNumbers: contact.phoneNumbers.filter(phone => {
        const cleaned = phone.replace(/\D/g, '');
        return /^[6-9]\d{9}$/.test(cleaned) || /^91[6-9]\d{9}$/.test(cleaned);
      })
    }));
  }

  /**
   * Get contact statistics
   */
  getContactStats(contacts: DeviceContact[]): {
    total: number;
    withValidMobile: number;
    selected: number;
  } {
    const validMobileContacts = this.filterContactsWithValidMobileNumbers(contacts);
    const selectedContacts = contacts.filter(c => c.selected);

    return {
      total: contacts.length,
      withValidMobile: validMobileContacts.length,
      selected: selectedContacts.length,
    };
  }
}

export default new ContactsService();
