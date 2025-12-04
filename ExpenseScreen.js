import React, { useEffect, useState } from 'react';
import {
  SafeAreaView,
  View,
  Text,
  TextInput,
  Button,
  FlatList,
  TouchableOpacity,
  StyleSheet,
} from 'react-native';
import { useSQLiteContext } from 'expo-sqlite';
import Svg, { Path } from 'react-native-svg';

// simple, dependency-light pie chart using react-native-svg
const SimplePieChart = ({ data, size = 180, colors = [] }) => {
  const entries = Object.entries(data).filter(([, v]) => v > 0);
  const total = entries.reduce((s, [, v]) => s + v, 0);
  if (total === 0) return null;

  const cx = size / 2;
  const cy = size / 2;
  const r = size / 2 - 2;
  let start = -Math.PI / 2;
  const slices = entries.map(([k, v], i) => {
    const angle = (v / total) * Math.PI * 2;
    const end = start + angle;
    const x1 = cx + r * Math.cos(start);
    const y1 = cy + r * Math.sin(start);
    const x2 = cx + r * Math.cos(end);
    const y2 = cy + r * Math.sin(end);
    const largeArc = angle > Math.PI ? 1 : 0;
    const d = `M ${cx} ${cy} L ${x1.toFixed(2)} ${y1.toFixed(2)} A ${r} ${r} 0 ${largeArc} 1 ${x2.toFixed(2)} ${y2.toFixed(2)} Z`;
    const slice = <Path key={k} d={d} fill={colors[i % colors.length]} />;
    start = end;
    return slice;
  });

  return <Svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>{slices}</Svg>;
};

export default function ExpenseScreen() {
  const db = useSQLiteContext();

  const [expenses, setExpenses] = useState([]);
  const [amount, setAmount] = useState('');
  const [category, setCategory] = useState('');
  const [note, setNote] = useState('');
  const [date, setDate] = useState('');
  const [filter, setFilter] = useState('all'); // 'all' | 'week' | 'month'
  const [categoryFilter, setCategoryFilter] = useState('all'); // 'all' or category string
  const [editingId, setEditingId] = useState(null); // null = adding, number = editing existing

  const loadExpenses = async () => {
    const rows = await db.getAllAsync(
      'SELECT * FROM expenses ORDER BY id DESC;'
    );
    setExpenses(rows);
  };
  const addExpense = async () => {
    const amountNumber = parseFloat(amount);

    if (isNaN(amountNumber) || amountNumber <= 0) {
      // Basic validation: ignore invalid or non-positive amounts
      return;
    }

    const trimmedCategory = category.trim();
    const trimmedNote = note.trim();

    if (!trimmedCategory) {
      // Category is required
      return;
    }

    // Normalize/validate date to ISO YYYY-MM-DD or null
    let dateIso = null;
    if (date) {
      // if already YYYY-MM-DD accept it; otherwise try parsing and converting
      if (/^\d{4}-\d{2}-\d{2}$/.test(date)) {
        dateIso = date;
      } else {
        const parsed = new Date(date);
        if (!isNaN(parsed.getTime())) {
          dateIso = parsed.toISOString().slice(0, 10);
        } else {
          // invalid date input: clear and treat as null
          dateIso = null;
        }
      }
    }

    if (editingId !== null) {
      await db.runAsync(
        'UPDATE expenses SET amount = ?, category = ?, note = ?, date = ? WHERE id = ?;',
        [amountNumber, trimmedCategory, trimmedNote || null, dateIso, editingId]
      );
    } else {
      await db.runAsync(
        'INSERT INTO expenses (amount, category, note, date) VALUES (?, ?, ?, ?);',
        [amountNumber, trimmedCategory, trimmedNote || null, dateIso]
      );
    }

    // clear form + exit edit mode
    setAmount('');
    setCategory('');
    setNote('');
    setDate('');
    setEditingId(null);

    loadExpenses();
  };


  const deleteExpense = async (id) => {
    await db.runAsync('DELETE FROM expenses WHERE id = ?;', [id]);
    loadExpenses();
  };


  const renderExpense = ({ item }) => {
    const isoDate = item.date ? (() => {
      const d = new Date(item.date);
      return isNaN(d.getTime()) ? null : d.toISOString().slice(0, 10);
    })() : null;

    return (
      <View style={styles.expenseRow}>
        <View style={{ flex: 1 }}>
          <Text style={styles.expenseAmount}>${Number(item.amount).toFixed(2)}</Text>
          <Text style={styles.expenseCategory}>{item.category}</Text>
          {item.note ? <Text style={styles.expenseNote}>{item.note}</Text> : null}
          {isoDate ? <Text style={styles.expenseNote}>{isoDate}</Text> : null}
        </View>

        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
          <TouchableOpacity
            onPress={() => {
              // populate form and enter edit mode
              setAmount(String(item.amount));
              setCategory(item.category || '');
              setNote(item.note || '');
              setDate(item.date ? (new Date(item.date)).toISOString().slice(0, 10) : '');
              setEditingId(item.id);
            }}
            style={{ marginRight: 12 }}
          >
            <Text style={{ color: '#60a5fa', fontSize: 16 }}>Edit</Text>
          </TouchableOpacity>

          <TouchableOpacity onPress={() => deleteExpense(item.id)}>
            <Text style={styles.delete}>✕</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  };

  // compute filteredExpenses based on time filter state (All / week / month)
  const filteredExpenses = expenses.filter((item) => {
    if (filter === 'all') return true;
    if (!item.date) return false;

    const d = new Date(item.date);
    if (isNaN(d.getTime())) return false;

    const now = new Date();

    if (filter === 'week') {
      const sevenDaysAgo = new Date();
      sevenDaysAgo.setDate(now.getDate() - 6); // include today and last 6 days = 7-day window
      // compare only date part
      const dateOnly = new Date(d.getFullYear(), d.getMonth(), d.getDate());
      return dateOnly >= new Date(sevenDaysAgo.getFullYear(), sevenDaysAgo.getMonth(), sevenDaysAgo.getDate());
    }

    if (filter === 'month') {
      return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth();
    }

    return true;
  });

  // totals per category for the currently time-filtered set
  const totalsByCategory = filteredExpenses.reduce((acc, it) => {
    const cat = it.category || 'Other';
    const n = parseFloat(it.amount);
    acc[cat] = (acc[cat] || 0) + (isNaN(n) ? 0 : n);
    return acc;
  }, {});

  // pie entries and palette (used for chart + legend)
  const pieEntries = Object.entries(totalsByCategory).sort((a, b) => b[1] - a[1]);
  const pieColors = ['#fbbf24', '#60a5fa', '#34d399', '#f87171', '#a78bfa', '#fb923c', '#14b8a6', '#ec4899'];

  // apply category filter on top of time-based filtering
  const finalFiltered = filteredExpenses.filter((it) =>
    categoryFilter === 'all' ? true : it.category === categoryFilter
  );

  // sum of amounts for currently visible (time + category filtered) expenses
  const visibleTotal = finalFiltered.reduce((sum, it) => {
    const n = parseFloat(it.amount);
    return sum + (isNaN(n) ? 0 : n);
  }, 0);

  // helper label for the current time filter
  const filterLabel = filter === 'week' ? 'This Week' : filter === 'month' ? 'This Month' : 'All';

  useEffect(() => {
    async function setup() {
      await db.execAsync(`
        CREATE TABLE IF NOT EXISTS expenses (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          amount REAL NOT NULL,
          category TEXT NOT NULL,
          note TEXT,
          date TEXT
        );
      `);

      // For existing DBs without the column: try to add it (ignore failure)
      try {
        await db.execAsync('ALTER TABLE expenses ADD COLUMN date TEXT;');
      } catch (e) {
        // column probably already exists or ALTER not allowed — ignore
      }

      await loadExpenses();
    }

    setup();
  }, []);
  
  return (
    <SafeAreaView style={styles.container}>
      <Text style={styles.heading}>Student Expense Tracker</Text>
  
      <View style={styles.form}>
        <TextInput
          style={styles.input}
          placeholder="Amount (e.g. 12.50)"
          placeholderTextColor="#9ca3af"
          keyboardType="numeric"
          value={amount}
          onChangeText={setAmount}
        />
        <TextInput
          style={styles.input}
          placeholder="Category (Food, Books, Rent...)"
          placeholderTextColor="#9ca3af"
          value={category}
          onChangeText={setCategory}
        />
        <TextInput
          style={styles.input}
          placeholder="Note (optional)"
          placeholderTextColor="#9ca3af"
          value={note}
          onChangeText={setNote}
        />
        <TextInput
          style={styles.input}
          placeholder="Date (YYYY-MM-DD) — ISO"
          placeholderTextColor="#9ca3af"
          value={date}
          onChangeText={(text) => {
            // allow only digits and hyphens, max length 10
            const cleaned = text.replace(/[^0-9-]/g, '').slice(0, 10);
            setDate(cleaned);
          }}
          onEndEditing={() => {
            // optional: if not a full ISO date, clear it (keeps UI strict)
            if (date && !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
              setDate('');
            }
          }}
        />
        <View style={{ flexDirection: 'row', gap: 8, marginTop: 8 }}>
          <Button title={editingId ? 'Save changes' : 'Add Expense'} onPress={addExpense} />
          {editingId ? (
            <Button
              title="Cancel"
              color="#f87171"
              onPress={() => {
                setEditingId(null);
                setAmount('');
                setCategory('');
                setNote('');
                setDate('');
              }}
            />
          ) : null}
        </View>
      </View>
  
      {/* Filter controls */}
      <View style={{ flexDirection: 'row', justifyContent: 'center', marginBottom: 8 }}>
        <TouchableOpacity onPress={() => setFilter('all')} style={{ marginHorizontal: 6 }}>
          <Text style={{ color: filter === 'all' ? '#fff' : '#9ca3af' }}>All</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={() => setFilter('week')} style={{ marginHorizontal: 6 }}>
          <Text style={{ color: filter === 'week' ? '#fff' : '#9ca3af' }}>This week</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={() => setFilter('month')} style={{ marginHorizontal: 6 }}>
          <Text style={{ color: filter === 'month' ? '#fff' : '#9ca3af' }}>This month</Text>
        </TouchableOpacity>
      </View>
  
      {/* Visible total */}
      <View style={styles.totalContainer}>
        <Text style={styles.totalLabel}>Total (visible):</Text>
        <Text style={styles.totalAmount}>${visibleTotal.toFixed(2)}</Text>
      </View>

      {/* Pie chart for current time filter (uses totalsByCategory) */}
      {pieEntries.length > 0 && (
        <View style={styles.pieContainer}>
          <Text style={styles.pieTitle}>Spending by Category</Text>
          <View style={{ alignItems: 'center', marginVertical: 10 }}>
            <SimplePieChart data={totalsByCategory} size={180} colors={pieColors} />
          </View>
          <View style={styles.pieLegend}>
            {pieEntries.map(([cat, value], idx) => {
              const total = pieEntries.reduce((s, [, v]) => s + v, 0);
              const pct = total ? ((value / total) * 100).toFixed(1) : '0.0';
              return (
                <View key={cat} style={styles.legendRow}>
                  <View style={[styles.legendDot, { backgroundColor: pieColors[idx % pieColors.length] }]} />
                  <Text style={styles.legendCat}>{cat}</Text>
                  <Text style={styles.legendValue}>${value.toFixed(2)}</Text>
                  <Text style={styles.legendPercent}>({pct}%)</Text>
                </View>
              );
            })}
          </View>
        </View>
      )}
 
      {/* By Category (filtered set) — tappable to filter list by category */}
      <View style={styles.byCategoryContainer}>
        <Text style={styles.byCategoryTitle}>By Category ({filterLabel}):</Text>
        {Object.keys(totalsByCategory).length === 0 ? (
          <Text style={styles.byCategoryEmpty}>No category totals</Text>
        ) : (
          <>
            {/* "All" entry to clear category filter */}
            <TouchableOpacity onPress={() => setCategoryFilter('all')} style={[styles.byCategoryRow, categoryFilter === 'all' && styles.byCategoryActive]}>
              <Text style={styles.byCategoryLabel}>• All</Text>
              <Text style={styles.byCategoryAmount}>${Object.values(totalsByCategory).reduce((s, v) => s + v, 0).toFixed(2)}</Text>
            </TouchableOpacity>

            {Object.entries(totalsByCategory)
              // optional: sort by descending amount so biggest categories appear first
              .sort((a, b) => b[1] - a[1])
              .map(([cat, sum]) => (
                <TouchableOpacity
                  key={cat}
                  onPress={() => setCategoryFilter(cat)}
                  style={[styles.byCategoryRow, categoryFilter === cat && styles.byCategoryActive]}
                >
                  <Text style={styles.byCategoryLabel}>• {cat}</Text>
                  <Text style={styles.byCategoryAmount}>${sum.toFixed(2)}</Text>
                </TouchableOpacity>
              ))}
          </>
        )}
      </View>
  
      <FlatList
        data={finalFiltered}
        keyExtractor={(item) => item.id.toString()}
        renderItem={renderExpense}
        ListEmptyComponent={<Text style={styles.empty}>No expenses yet.</Text>}
      />
  
      <Text style={styles.footer}>
        Enter your expenses and they’ll be saved locally with SQLite.
      </Text>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 16, backgroundColor: '#111827' },
  heading: {
    fontSize: 24,
    fontWeight: '700',
    color: '#fff',
    marginBottom: 16,
  },
  form: {
    marginBottom: 16,
    gap: 8,
  },
  input: {
    padding: 10,
    backgroundColor: '#1f2937',
    color: '#fff',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#374151',
  },
  expenseRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1f2937',
    padding: 12,
    borderRadius: 8,
    marginBottom: 8,
  },
  expenseAmount: {
    fontSize: 18,
    fontWeight: '700',
    color: '#fbbf24',
  },
  expenseCategory: {
    fontSize: 14,
    color: '#e5e7eb',
  },
  expenseNote: {
    fontSize: 12,
    color: '#9ca3af',
  },
  delete: {
    color: '#f87171',
    fontSize: 20,
    marginLeft: 12,
  },
  empty: {
    color: '#9ca3af',
    marginTop: 24,
    textAlign: 'center',
  },
  footer: {
    textAlign: 'center',
    color: '#6b7280',
    marginTop: 12,
    fontSize: 12,
  },
  totalContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 12,
    backgroundColor: '#0f172a',
    borderRadius: 8,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#1f2a44',
  },
  totalLabel: {
    color: '#9ca3af',
    fontSize: 14,
  },
  totalAmount: {
    color: '#fbbf24',
    fontSize: 16,
    fontWeight: '700',
  },
  byCategoryContainer: {
    backgroundColor: '#1f2937',
    borderRadius: 8,
    padding: 12,
    marginBottom: 16,
  },
  byCategoryTitle: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 8,
  },
  byCategoryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 4,
  },
  byCategoryLabel: {
    color: '#e5e7eb',
    fontSize: 14,
  },
  byCategoryAmount: {
    color: '#fbbf24',
    fontSize: 14,
    fontWeight: '700',
  },
  byCategoryEmpty: {
    color: '#9ca3af',
    fontSize: 14,
    textAlign: 'center',
    paddingVertical: 8,
  },
  byCategoryActive: {
    backgroundColor: '#081226',
    borderRadius: 6,
  },
  /* pie chart styles */
  pieContainer: {
    backgroundColor: '#1f2937',
    borderRadius: 8,
    padding: 12,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#374151',
  },
  pieTitle: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '600',
    textAlign: 'center',
    marginBottom: 6,
  },
  pieLegend: {
    marginTop: 8,
  },
  legendRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 4,
  },
  legendDot: {
    width: 10,
    height: 10,
    borderRadius: 3,
    marginRight: 8,
  },
  legendCat: {
    color: '#e5e7eb',
    fontSize: 13,
    flex: 1,
  },
  legendValue: {
    color: '#fbbf24',
    fontSize: 13,
    fontWeight: '700',
    marginRight: 6,
  },
  legendPercent: {
    color: '#9ca3af',
    fontSize: 12,
  },
});
// add a pie chart that visualizes the expense distribution by category