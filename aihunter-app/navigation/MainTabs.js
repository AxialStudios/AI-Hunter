import { TouchableOpacity, View, Text, Animated, StyleSheet } from 'react-native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import GameplayScreen    from '../features/gameplay/GameplayScreen';
import DailyScreen       from '../features/daily/DailyScreen';
import LeaderboardScreen from '../features/leaderboard/LeaderboardScreen';
import ProfileScreen     from '../features/profile/ProfileScreen';
import { colors, fonts } from '../constants/theme';
import { useTutorial } from '../context/TutorialContext';

const Tab = createBottomTabNavigator();

const TABS = [
  { name: 'Play',     label: 'Play',     icon: 'eye',      component: GameplayScreen    },
  { name: 'Daily',    label: 'Daily',    icon: 'calendar', component: DailyScreen       },
  { name: 'Rankings', label: 'Rankings', icon: 'award',    component: LeaderboardScreen },
  { name: 'Profile',  label: 'Profile',  icon: 'user',     component: ProfileScreen     },
];

function TabBar({ state, navigation }) {
  const insets = useSafeAreaInsets();
  const { tutorialActive, tabBarOpacity } = useTutorial();
  if (tutorialActive) return null;
  return (
    <Animated.View style={[styles.bar, { paddingBottom: insets.bottom || 12, opacity: tabBarOpacity }]}>
      {state.routes.map((route, i) => {
        const focused = state.index === i;
        const tab = TABS[i];
        return (
          <TouchableOpacity
            key={route.key}
            style={styles.tab}
            onPress={() => navigation.navigate(route.name)}
            activeOpacity={0.6}
          >
            <Feather
              name={tab.icon}
              size={22}
              color={focused ? colors.textPrimary : '#383838'}
            />
            <Text style={[styles.label, focused && styles.labelActive]}>
              {tab.label}
            </Text>
          </TouchableOpacity>
        );
      })}
    </Animated.View>
  );
}

export default function MainTabs() {
  return (
    <Tab.Navigator
      tabBar={props => <TabBar {...props} />}
      screenOptions={{ headerShown: false }}
    >
      {TABS.map(tab => (
        <Tab.Screen key={tab.name} name={tab.name} component={tab.component} />
      ))}
    </Tab.Navigator>
  );
}

const styles = StyleSheet.create({
  bar: {
    flexDirection: 'row',
    backgroundColor: colors.bg,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: '#222222',
    paddingTop: 10,
  },
  tab: {
    flex: 1,
    alignItems: 'center',
    gap: 4,
  },
  label: {
    fontSize: 10,
    fontFamily: fonts.medium,
    color: '#383838',
  },
  labelActive: {
    color: colors.textPrimary,
  },
});
