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

export default function ExpenseScreen() {
  const db = useSQLiteContext();

  const [expenses, setExpenses] = useState([]);
  const [amount, setAmount] = useState('');
  const [category, setCategory] = useState('');
  const [note, setNote] = useState('');
  const [date, setDate] = useState('');
  const [filter, setFilter] = useState('all'); // 'all' | 'week' | 'month'

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

    await db.runAsync(
      'INSERT INTO expenses (amount, category, note, date) VALUES (?, ?, ?, ?);',
      [amountNumber, trimmedCategory, trimmedNote || null, dateIso]
    );

    setAmount('');
    setCategory('');
    setNote('');
    setDate('');

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

        <TouchableOpacity onPress={() => deleteExpense(item.id)}>
          <Text style={styles.delete}>✕</Text>
        </TouchableOpacity>
      </View>
    );
  };

  // compute filteredExpenses based on filter state
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

  // sum of amounts for currently visible (filtered) expenses
  const visibleTotal = filteredExpenses.reduce((sum, it) => {
    const n = parseFloat(it.amount);
    return sum + (isNaN(n) ? 0 : n);
  }, 0);

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
        <Button title="Add Expense" onPress={addExpense} />
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
  
      <FlatList
        data={filteredExpenses}
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
});