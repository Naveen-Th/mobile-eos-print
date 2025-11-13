import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Dimensions } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

interface PaginationProps {
  currentPage: number;
  totalItems: number;
  itemsPerPage: number;
  onPageChange: (page: number) => void;
}

const Pagination: React.FC<PaginationProps> = ({
  currentPage,
  totalItems,
  itemsPerPage,
  onPageChange,
}) => {
  const totalPages = Math.ceil(totalItems / itemsPerPage);
  const screenWidth = Dimensions.get('window').width;
  const isMobile = screenWidth < 400;
  
  // Don't show pagination if there's only one page or no items
  if (totalPages <= 1) return null;

  const getPageNumbers = () => {
    const pages: (number | string)[] = [];
    const maxVisible = isMobile ? 3 : 5; // Show fewer pages on small screens

    if (totalPages <= maxVisible + 2) {
      // Show all pages if total is small
      for (let i = 1; i <= totalPages; i++) {
        pages.push(i);
      }
    } else {
      // Always show first page
      pages.push(1);

      // Calculate range around current page
      let start = Math.max(2, currentPage - 1);
      let end = Math.min(totalPages - 1, currentPage + 1);

      // Adjust range if at beginning or end
      if (currentPage <= 2) {
        end = Math.min(maxVisible, totalPages - 1);
      } else if (currentPage >= totalPages - 1) {
        start = Math.max(2, totalPages - maxVisible + 1);
      }

      // Add ellipsis after first page if needed
      if (start > 2) {
        pages.push('...');
      }

      // Add middle pages
      for (let i = start; i <= end; i++) {
        pages.push(i);
      }

      // Add ellipsis before last page if needed
      if (end < totalPages - 1) {
        pages.push('...');
      }

      // Always show last page
      pages.push(totalPages);
    }

    return pages;
  };

  const startItem = (currentPage - 1) * itemsPerPage + 1;
  const endItem = Math.min(currentPage * itemsPerPage, totalItems);

  return (
    <View style={styles.container}>
      {/* Info section - showing which items are displayed */}
      <View style={styles.infoContainer}>
        <Text style={styles.infoText}>
          Showing <Text style={styles.infoBold}>{startItem}-{endItem}</Text> of{' '}
          <Text style={styles.infoBold}>{totalItems}</Text> receipts
        </Text>
      </View>

      {/* Pagination controls */}
      <View style={styles.paginationControls}>
        {/* Previous button */}
        <TouchableOpacity
          style={[
            styles.navButton,
            currentPage === 1 && styles.navButtonDisabled,
          ]}
          onPress={() => onPageChange(currentPage - 1)}
          disabled={currentPage === 1}
          activeOpacity={0.6}
        >
          <Ionicons
            name="chevron-back"
            size={18}
            color={currentPage === 1 ? '#cbd5e1' : '#ffffff'}
          />
          {!isMobile && (
            <Text
              style={[
                styles.navButtonText,
                currentPage === 1 && styles.navButtonTextDisabled,
              ]}
            >
              Pre
            </Text>
          )}
        </TouchableOpacity>

        {/* Page numbers */}
        <View style={styles.pageNumbers}>
          {getPageNumbers().map((page, index) => {
            if (page === '...') {
              return (
                <View key={`ellipsis-${index}`} style={styles.ellipsis}>
                  <Text style={styles.ellipsisText}>···</Text>
                </View>
              );
            }

            const pageNum = page as number;
            const isActive = pageNum === currentPage;

            return (
              <TouchableOpacity
                key={pageNum}
                style={[
                  styles.pageButton,
                  isActive && styles.pageButtonActive,
                ]}
                onPress={() => onPageChange(pageNum)}
                activeOpacity={0.6}
              >
                <Text
                  style={[
                    styles.pageButtonText,
                    isActive && styles.pageButtonTextActive,
                  ]}
                >
                  {pageNum}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>

        {/* Next button */}
        <TouchableOpacity
          style={[
            styles.navButton,
            currentPage === totalPages && styles.navButtonDisabled,
          ]}
          onPress={() => onPageChange(currentPage + 1)}
          disabled={currentPage === totalPages}
          activeOpacity={0.6}
        >
          {!isMobile && (
            <Text
              style={[
                styles.navButtonText,
                currentPage === totalPages && styles.navButtonTextDisabled,
              ]}
            >
              Next
            </Text>
          )}
          <Ionicons
            name="chevron-forward"
            size={18}
            color={currentPage === totalPages ? '#cbd5e1' : '#ffffff'}
          />
        </TouchableOpacity>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#ffffff',
    paddingVertical: 20,
    paddingHorizontal: 16,
    borderTopWidth: 1,
    borderTopColor: '#e5e7eb',
  },
  infoContainer: {
    alignItems: 'center',
    marginBottom: 16,
  },
  infoText: {
    fontSize: 13,
    color: '#6b7280',
    letterSpacing: 0.3,
  },
  infoBold: {
    fontWeight: '700',
    color: '#111827',
  },
  paginationControls: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  navButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 10,
    backgroundColor: '#3b82f6',
    gap: 6,
    minWidth: 44,
    minHeight: 44,
    shadowColor: '#3b82f6',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
    elevation: 2,
  },
  navButtonDisabled: {
    backgroundColor: '#f3f4f6',
    shadowOpacity: 0,
    elevation: 0,
  },
  navButtonText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#ffffff',
    letterSpacing: 0.3,
  },
  navButtonTextDisabled: {
    color: '#d1d5db',
  },
  pageNumbers: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 8,
  },
  pageButton: {
    minWidth: 40,
    height: 40,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#ffffff',
    borderWidth: 1.5,
    borderColor: '#e5e7eb',
  },
  pageButtonActive: {
    backgroundColor: '#3b82f6',
    borderColor: '#3b82f6',
    shadowColor: '#3b82f6',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.25,
    shadowRadius: 6,
    elevation: 4,
    transform: [{ scale: 1.05 }],
  },
  pageButtonText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#374151',
  },
  pageButtonTextActive: {
    color: '#ffffff',
    fontWeight: '700',
  },
  ellipsis: {
    minWidth: 32,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ellipsisText: {
    fontSize: 16,
    color: '#9ca3af',
    fontWeight: '700',
    letterSpacing: 2,
  },
});

export default Pagination;

