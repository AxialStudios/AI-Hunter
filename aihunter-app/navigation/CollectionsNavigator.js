import { createNativeStackNavigator } from '@react-navigation/native-stack';
import CollectionsListScreen from '../features/collections/CollectionsListScreen';
import CollectionPlayScreen  from '../features/collections/CollectionPlayScreen';

const Stack = createNativeStackNavigator();

export default function CollectionsNavigator() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="CollectionsList" component={CollectionsListScreen} />
      <Stack.Screen name="CollectionPlay"  component={CollectionPlayScreen}  />
    </Stack.Navigator>
  );
}
