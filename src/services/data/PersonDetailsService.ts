import {
  collection,
  doc,
  addDoc,
  updateDoc,
  deleteDoc,
  getDocs,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  Timestamp,
} from 'firebase/firestore';
import { parsePhoneNumber, isValidPhoneNumber } from 'libphonenumber-js';
import { getFirebaseDb, isFirebaseInitialized } from '../../config/firebase';

export interface PersonDetail {
  id: string;
  personName: string;
  businessName: string;
  phoneNumber: string;
  balanceDue: number;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

export interface CreatePersonDetailData {
  personName: string;
  businessName: string;
  phoneNumber: string;
  balanceDue?: number;
}

export interface UpdatePersonDetailData {
  personName?: string;
  businessName?: string;
  phoneNumber?: string;
  balanceDue?: number;
}

class PersonDetailsService {
  private collectionName = 'person_details';

  /**
   * Create a new person detail with validation
   */
  async createPersonDetail(data: CreatePersonDetailData): Promise<{ success: boolean; id?: string; error?: string }> {
    try {
      const db = getFirebaseDb();
      // Check if Firebase is initialized
      if (!isFirebaseInitialized() || !db) {
        console.log('📴 Firebase not initialized - cannot create person detail');
        return {
          success: false,
          error: 'Cannot create party while offline. Please connect to internet.'
        };
      }
      
      // Validate input data
      const validation = this.validatePersonDetail(data);
      if (!validation.isValid) {
        return {
          success: false,
          error: `Validation failed: ${validation.errors.join(', ')}`
        };
      }
      
      // Clean and format phone number
      const phoneValidation = this.validateIndianMobileNumber(data.phoneNumber);
      if (!phoneValidation.isValid) {
        return {
          success: false,
          error: phoneValidation.error
        };
      }
      
      // Check for duplicate phone numbers
      const existingPersons = await this.getPersonDetails();
      const duplicatePhone = existingPersons.find(person => {
        const cleanExisting = person.phoneNumber.replace(/\D/g, '');
        const cleanNew = data.phoneNumber.replace(/\D/g, '');
        return cleanExisting === cleanNew || cleanExisting.endsWith(cleanNew) || cleanNew.endsWith(cleanExisting);
      });
      
      if (duplicatePhone) {
        return {
          success: false,
          error: `Phone number already exists for ${duplicatePhone.personName}`
        };
      }
      
      const docRef = await addDoc(collection(db, this.collectionName), {
        personName: data.personName.trim(),
        businessName: data.businessName.trim(),
        phoneNumber: phoneValidation.formatted || data.phoneNumber,
        balanceDue: data.balanceDue || 0,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });

      console.log('Person detail created successfully:', docRef.id);
      return { success: true, id: docRef.id };
    } catch (error: any) {
      console.error('Error creating person detail:', error);
      return { 
        success: false, 
        error: error.message || 'Failed to create person detail'
      };
    }
  }

  /**
   * Get all person details
   */
  async getPersonDetails(): Promise<PersonDetail[]> {
    try {
      const db = getFirebaseDb();
      // Check if Firebase is initialized
      if (!isFirebaseInitialized() || !db) {
        console.log('📴 Firebase not initialized - cannot get person details');
        return [];
      }
      
      const q = query(collection(db, this.collectionName), orderBy('createdAt', 'desc'));
      const querySnapshot = await getDocs(q);
      
      const persons: PersonDetail[] = [];
      querySnapshot.forEach((doc) => {
        persons.push({
          id: doc.id,
          ...doc.data(),
        } as PersonDetail);
      });

      console.log('Person details fetched:', persons.length);
      return persons;
    } catch (error) {
      console.error('Error fetching person details:', error);
      return [];
    }
  }

  /**
   * Update a person detail with validation
   */
  async updatePersonDetail(id: string, data: UpdatePersonDetailData): Promise<{ success: boolean; error?: string }> {
    try {
      const db = getFirebaseDb();
      // Check if Firebase is initialized
      if (!isFirebaseInitialized() || !db) {
        console.log('📴 Firebase not initialized - cannot update person detail');
        return {
          success: false,
          error: 'Cannot update party while offline. Please connect to internet.'
        };
      }
      
      // Validate ID
      if (!id || typeof id !== 'string') {
        return { success: false, error: 'Valid person ID is required' };
      }
      
      // Validate input data has at least one field to update
      const hasData = data.personName || data.businessName || data.phoneNumber || data.balanceDue !== undefined;
      if (!hasData) {
        return { success: false, error: 'At least one field must be provided for update' };
      }
      
      // Validate phone number if provided
      if (data.phoneNumber) {
        const phoneValidation = this.validateIndianMobileNumber(data.phoneNumber);
        if (!phoneValidation.isValid) {
          return {
            success: false,
            error: phoneValidation.error
          };
        }
        
        // Check for duplicate phone numbers (excluding current person)
        const existingPersons = await this.getPersonDetails();
        const duplicatePhone = existingPersons.find(person => {
          if (person.id === id) return false; // Skip current person
          const cleanExisting = person.phoneNumber.replace(/\D/g, '');
          const cleanNew = data.phoneNumber!.replace(/\D/g, '');
          return cleanExisting === cleanNew;
        });
        
        if (duplicatePhone) {
          return {
            success: false,
            error: `Phone number already exists for ${duplicatePhone.personName}`
          };
        }
        
        // Use formatted phone number
        data.phoneNumber = phoneValidation.formatted || data.phoneNumber;
      }
      
      // Trim text fields
      const updateData: any = { updatedAt: serverTimestamp() };
      if (data.personName) updateData.personName = data.personName.trim();
      if (data.businessName) updateData.businessName = data.businessName.trim();
      if (data.phoneNumber) updateData.phoneNumber = data.phoneNumber;
      if (data.balanceDue !== undefined) updateData.balanceDue = data.balanceDue;
      
      const docRef = doc(db, this.collectionName, id);
      await updateDoc(docRef, updateData);

      console.log('Person detail updated successfully:', id);
      return { success: true };
    } catch (error: any) {
      console.error('Error updating person detail:', error);
      return { 
        success: false, 
        error: error.message || 'Failed to update person detail'
      };
    }
  }

  /**
   * Delete a person detail
   */
  async deletePersonDetail(id: string): Promise<{ success: boolean; error?: string }> {
    try {
      const db = getFirebaseDb();
      // Check if Firebase is initialized
      if (!isFirebaseInitialized() || !db) {
        console.log('📴 Firebase not initialized - cannot delete person detail');
        return {
          success: false,
          error: 'Cannot delete party while offline. Please connect to internet.'
        };
      }
      
      const docRef = doc(db, this.collectionName, id);
      await deleteDoc(docRef);

      console.log('Person detail deleted successfully:', id);
      return { success: true };
    } catch (error) {
      console.error('Error deleting person detail:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Subscribe to real-time person details updates
   */
  subscribeToPersonDetails(
    onUpdate: (persons: PersonDetail[]) => void,
    onError?: (error: Error) => void
  ): () => void {
    const db = getFirebaseDb();
    // Check if Firebase is initialized
    if (!isFirebaseInitialized() || !db) {
      console.log('📴 Firebase not initialized - skipping person details subscription');
      // Return empty list and a no-op unsubscribe
      onUpdate([]);
      return () => {};
    }
    
    try {
      const q = query(collection(db, this.collectionName), orderBy('createdAt', 'desc'));
      
      const unsubscribe = onSnapshot(q, 
        (snapshot) => {
          const persons: PersonDetail[] = [];
          snapshot.forEach((doc) => {
            persons.push({
              id: doc.id,
              ...doc.data(),
            } as PersonDetail);
          });

          console.log('🔄 Real-time update for person_details:', persons.length, 'documents');
          onUpdate(persons);
        },
        (error) => {
          console.error('Error in person details subscription:', error);
          if (onError) {
            onError(error);
          }
        }
      );

      return unsubscribe;
    } catch (error) {
      console.error('Error setting up person details subscription:', error);
      if (onError) {
        onError(error);
      }
      return () => {};
    }
  }

  /**
   * Search person details by name or phone
   */
  async searchPersonDetails(searchTerm: string): Promise<PersonDetail[]> {
    try {
      const allPersons = await this.getPersonDetails();
      const searchLower = searchTerm.toLowerCase();
      
      return allPersons.filter(person => 
        person.personName.toLowerCase().includes(searchLower) ||
        person.businessName.toLowerCase().includes(searchLower) ||
        person.phoneNumber.includes(searchTerm)
      );
    } catch (error) {
      console.error('Error searching person details:', error);
      return [];
    }
  }

  /**
   * Validate person detail data with Indian mobile number validation
   */
  validatePersonDetail(data: CreatePersonDetailData): { isValid: boolean; errors: string[] } {
    const errors: string[] = [];

    if (!data.personName?.trim()) {
      errors.push('Person name is required');
    }

    if (!data.businessName?.trim()) {
      errors.push('Business name is required');
    }

    if (!data.phoneNumber?.trim()) {
      errors.push('Phone number is required');
    } else {
      // Validate Indian mobile number
      const validationResult = this.validateIndianMobileNumber(data.phoneNumber.trim());
      if (!validationResult.isValid) {
        errors.push(validationResult.error!);
      }
    }

    return {
      isValid: errors.length === 0,
      errors
    };
  }

  /**
   * Validate Indian mobile number using libphonenumber-js with better error handling
   */
  private validateIndianMobileNumber(phoneNumber: string): { isValid: boolean; error?: string; formatted?: string } {
    try {
      // Input validation
      if (!phoneNumber || typeof phoneNumber !== 'string') {
        return {
          isValid: false,
          error: 'Phone number is required'
        };
      }
      
      // Clean the phone number - remove all non-digits
      let cleanNumber = phoneNumber.replace(/\D/g, '');
      
      // Handle empty clean number
      if (!cleanNumber) {
        return {
          isValid: false,
          error: 'Please enter a valid phone number with digits'
        };
      }
      
      // Handle numbers that are too short or too long
      if (cleanNumber.length < 10) {
        return {
          isValid: false,
          error: 'Phone number must be at least 10 digits long'
        };
      }
      
      if (cleanNumber.length > 15) {
        return {
          isValid: false,
          error: 'Phone number is too long'
        };
      }
      
      // Handle Indian country code scenarios
      if (cleanNumber.startsWith('91') && cleanNumber.length === 12) {
        // Number already has country code, extract the mobile number
        const mobileNumber = cleanNumber.substring(2);
        if (/^[6-9]\d{9}$/.test(mobileNumber)) {
          cleanNumber = '+91' + mobileNumber;
        } else {
          return {
            isValid: false,
            error: 'Indian mobile numbers must start with 6, 7, 8, or 9'
          };
        }
      } else if (/^[6-9]\d{9}$/.test(cleanNumber)) {
        // 10 digit number starting with 6-9, add country code
        cleanNumber = '+91' + cleanNumber;
      } else if (cleanNumber.length === 10 && !cleanNumber.startsWith('6') && !cleanNumber.startsWith('7') && !cleanNumber.startsWith('8') && !cleanNumber.startsWith('9')) {
        return {
          isValid: false,
          error: 'Indian mobile numbers must start with 6, 7, 8, or 9'
        };
      }
      
      // Try to parse with libphonenumber-js
      try {
        const phoneNumberObj = parsePhoneNumber(cleanNumber, 'IN');
        
        if (!phoneNumberObj) {
          // Fallback validation for basic Indian mobile pattern
          const match = cleanNumber.match(/^\+91([6-9]\d{9})$/);
          if (match) {
            return {
              isValid: true,
              formatted: `+91 ${match[1].substring(0, 5)} ${match[1].substring(5)}`
            };
          }
          
          return {
            isValid: false,
            error: 'Invalid phone number format'
          };
        }
        
        // Validate that it's a mobile number pattern for India
        const nationalNumber = phoneNumberObj.nationalNumber;
        if (!/^[6-9]\d{9}$/.test(nationalNumber)) {
          return {
            isValid: false,
            error: 'Indian mobile numbers must be 10 digits starting with 6, 7, 8, or 9'
          };
        }
        
        // Additional validation - ensure it's not a special service number
        const firstTwoDigits = nationalNumber.substring(0, 2);
        const restrictedPrefixes = ['00', '01', '02', '03', '04', '05'];
        if (restrictedPrefixes.includes(firstTwoDigits)) {
          return {
            isValid: false,
            error: 'This appears to be a service number, not a mobile number'
          };
        }
        
        return {
          isValid: true,
          formatted: phoneNumberObj.formatInternational()
        };
      } catch (parseError) {
        console.warn('libphonenumber-js parse error:', parseError);
        
        // Fallback to regex validation
        const match = cleanNumber.match(/^\+91([6-9]\d{9})$/);
        if (match) {
          return {
            isValid: true,
            formatted: `+91 ${match[1].substring(0, 5)} ${match[1].substring(5)}`
          };
        }
        
        return {
          isValid: false,
          error: 'Unable to validate phone number format'
        };
      }
    } catch (error) {
      console.error('Phone validation error:', error);
      return {
        isValid: false,
        error: 'An error occurred while validating the phone number. Please try again.'
      };
    }
  }

  /**
   * Bulk import multiple contacts with validation and duplicate checking
   */
  async bulkImportContacts(contacts: CreatePersonDetailData[]): Promise<{
    success: boolean;
    results: {
      imported: number;
      skipped: number;
      failed: number;
    };
    errors: string[];
    details: Array<{
      contact: CreatePersonDetailData;
      status: 'imported' | 'skipped' | 'failed';
      reason?: string;
    }>;
  }> {
    try {
      if (!contacts || contacts.length === 0) {
        return {
          success: false,
          results: { imported: 0, skipped: 0, failed: 0 },
          errors: ['No contacts provided for import'],
          details: []
        };
      }

      // Get existing persons for duplicate checking
      const existingPersons = await this.getPersonDetails();
      
      let importedCount = 0;
      let skippedCount = 0;
      let failedCount = 0;
      const errors: string[] = [];
      const details: Array<{
        contact: CreatePersonDetailData;
        status: 'imported' | 'skipped' | 'failed';
        reason?: string;
      }> = [];

      for (const contact of contacts) {
        try {
          // Validate contact data
          const validation = this.validatePersonDetail(contact);
          if (!validation.isValid) {
            failedCount++;
            const reason = `Validation failed: ${validation.errors.join(', ')}`;
            errors.push(`${contact.personName}: ${reason}`);
            details.push({
              contact,
              status: 'failed',
              reason
            });
            continue;
          }

          // Validate phone number
          const phoneValidation = this.validateIndianMobileNumber(contact.phoneNumber);
          if (!phoneValidation.isValid) {
            failedCount++;
            const reason = phoneValidation.error || 'Invalid phone number';
            errors.push(`${contact.personName}: ${reason}`);
            details.push({
              contact,
              status: 'failed',
              reason
            });
            continue;
          }

          // Check for duplicate phone numbers
          const cleanNewPhone = contact.phoneNumber.replace(/\D/g, '');
          const duplicatePhone = existingPersons.find(person => {
            const cleanExistingPhone = person.phoneNumber.replace(/\D/g, '');
            return cleanExistingPhone === cleanNewPhone || 
                   cleanExistingPhone.endsWith(cleanNewPhone) || 
                   cleanNewPhone.endsWith(cleanExistingPhone);
          });

          if (duplicatePhone) {
            skippedCount++;
            const reason = `Phone number already exists for ${duplicatePhone.personName}`;
            details.push({
              contact,
              status: 'skipped',
              reason
            });
            continue;
          }

          // Check for duplicate person name and business name combination
          const duplicatePerson = existingPersons.find(person => 
            person.personName.toLowerCase().trim() === contact.personName.toLowerCase().trim() &&
            person.businessName.toLowerCase().trim() === contact.businessName.toLowerCase().trim()
          );

          if (duplicatePerson) {
            skippedCount++;
            const reason = `Person with same name and business already exists`;
            details.push({
              contact,
              status: 'skipped',
              reason
            });
            continue;
          }

          // Create the contact
          const result = await this.createPersonDetail({
            ...contact,
            phoneNumber: phoneValidation.formatted || contact.phoneNumber
          });

          if (result.success) {
            importedCount++;
            details.push({
              contact,
              status: 'imported'
            });
            
            // Add to existing persons list for subsequent duplicate checking
            existingPersons.push({
              id: result.id || 'temp',
              personName: contact.personName.trim(),
              businessName: contact.businessName.trim(),
              phoneNumber: phoneValidation.formatted || contact.phoneNumber,
              balanceDue: 0,
              createdAt: new Date() as any,
              updatedAt: new Date() as any,
            });
          } else {
            failedCount++;
            const reason = result.error || 'Unknown error during creation';
            errors.push(`${contact.personName}: ${reason}`);
            details.push({
              contact,
              status: 'failed',
              reason
            });
          }
        } catch (contactError: any) {
          failedCount++;
          const reason = contactError.message || 'Unexpected error';
          errors.push(`${contact.personName}: ${reason}`);
          details.push({
            contact,
            status: 'failed',
            reason
          });
        }
      }

      console.log(`Bulk import completed: ${importedCount} imported, ${skippedCount} skipped, ${failedCount} failed`);
      
      return {
        success: importedCount > 0 || (failedCount === 0 && skippedCount > 0),
        results: {
          imported: importedCount,
          skipped: skippedCount,
          failed: failedCount
        },
        errors,
        details
      };
    } catch (error: any) {
      console.error('Error in bulk import:', error);
      return {
        success: false,
        results: { imported: 0, skipped: 0, failed: 0 },
        errors: [error.message || 'Bulk import failed'],
        details: []
      };
    }
  }

  /**
   * Format phone number for display
   */
  formatPhoneNumber(phoneNumber: string): string {
    try {
      let cleanNumber = phoneNumber.replace(/\D/g, '');
      
      // Add +91 if number starts with digits and doesn't have country code
      if (/^[6-9]\d{9}$/.test(cleanNumber)) {
        cleanNumber = '+91' + cleanNumber;
      }
      
      const phoneNumberObj = parsePhoneNumber(cleanNumber, 'IN');
      if (phoneNumberObj && phoneNumberObj.isValid()) {
        return phoneNumberObj.formatInternational();
      }
      
      return phoneNumber; // Return original if parsing fails
    } catch (error) {
      return phoneNumber;
    }
  }
}

export default new PersonDetailsService();
