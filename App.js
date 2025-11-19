import { SQLiteProvider } from 'expo-sqlite';
import Main from './Main';

export default function App() {
  return (
    <SQLiteProvider databaseName="tasks.db">
      <Main />
    </SQLiteProvider>
  );
}