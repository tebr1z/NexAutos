import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, KeyboardAvoidingView, Platform, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { WebView, type WebViewMessageEvent, type WebViewNavigation } from 'react-native-webview';
import { hasSession, login, logout, profile, quote, type Profile, type Quote } from '../lib/api';
import { READ_BIDCARS_PAGE } from '../lib/injected';

type Lot = { url: string; title: string; priceUsd: number | null; auctionFeeUsd: number | null; location: string; state: string; auction: string; titleKind: string };
const money = (value: number | null | undefined) => value == null ? '—' : `$${value.toLocaleString('en-US', { maximumFractionDigits: 2 })}`;
const MobileWebView = WebView<Record<never, never>>;

export default function HomeScreen() {
  const web = useRef<WebView<Record<never, never>>>(null);
  const [ready, setReady] = useState(false), [signedIn, setSignedIn] = useState(false), [busy, setBusy] = useState(false);
  const [email, setEmail] = useState(''), [password, setPassword] = useState(''), [error, setError] = useState('');
  const [account, setAccount] = useState<Profile | null>(null), [lot, setLot] = useState<Lot | null>(null), [result, setResult] = useState<Quote | null>(null);
  const brand = account?.brandName?.trim() || 'Auto Nex';

  useEffect(() => { void (async () => { const exists = await hasSession(); setSignedIn(exists); if (exists) await loadProfile(); setReady(true); })(); }, []);
  async function loadProfile() { try { const row = await profile(); setAccount(row); if (row.expired) setError(row.accessMessage || 'İstifadə müddəti bitib.'); } catch (e) { setError(e instanceof Error ? e.message : 'Profil açılmadı.'); } }
  async function signIn() { setBusy(true); setError(''); try { await login(email, password); setSignedIn(true); await loadProfile(); } catch (e) { setError(e instanceof Error ? e.message : 'Giriş alınmadı.'); } finally { setBusy(false); } }
  async function signOut() { await logout(); setSignedIn(false); setAccount(null); setResult(null); setLot(null); }
  function readPage() { setError(''); web.current?.injectJavaScript(READ_BIDCARS_PAGE); }
  function receive(event: WebViewMessageEvent) { try { const message = JSON.parse(event.nativeEvent.data); if (message.type === 'lot') { setLot(message); setResult(null); } else setError(message.message || 'Səhifə oxunmadı.'); } catch { setError('BidCars cavabı oxunmadı.'); } }
  async function calculate() {
    if (!lot?.priceUsd || !lot.auction || !lot.location || !lot.state) return setError('Qiymət, hərrac və Location tapılmadı. BidCars lot səhifəsini tam açıb yenidən oxuyun.');
    setBusy(true); setError('');
    try { setResult(await quote({ url: lot.url, priceUsd: lot.priceUsd, auctionFeeUsd: lot.auctionFeeUsd || undefined, auction: lot.auction, yard: lot.location, state: lot.state, titleKind: lot.titleKind })); await loadProfile(); }
    catch (e) { setError(e instanceof Error ? e.message : 'Hesablama alınmadı.'); } finally { setBusy(false); }
  }

  if (!ready) return <View style={styles.center}><ActivityIndicator color="#60a5fa" /></View>;
  if (!signedIn) return <SafeAreaView style={styles.screen}><KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.login}>
    <View style={styles.logo}><Text style={styles.logoText}>N</Text></View><Text style={styles.title}>Auto Nex Mobile</Text><Text style={styles.muted}>Kalkulyator hesabınızla daxil olun</Text>
    <TextInput value={email} onChangeText={setEmail} autoCapitalize="none" keyboardType="email-address" placeholder="E-poçt" placeholderTextColor="#64748b" style={styles.input} />
    <TextInput value={password} onChangeText={setPassword} secureTextEntry placeholder="Şifrə" placeholderTextColor="#64748b" style={styles.input} />
    {error ? <Text style={styles.error}>{error}</Text> : null}<Pressable disabled={busy} onPress={signIn} style={styles.primary}><Text style={styles.primaryText}>{busy ? 'Gözləyin…' : 'Giriş'}</Text></Pressable>
    <Text style={styles.note}>Qeydiyyat üçün VexiraLabs ilə əlaqə qurun.</Text>
  </KeyboardAvoidingView></SafeAreaView>;

  return <SafeAreaView style={styles.screen}>
    <View style={styles.header}><View><Text style={styles.brand}>{brand}</Text><Text style={styles.muted}>Mobil BidCars kalkulyatoru · test</Text></View><Pressable onPress={signOut}><Text style={styles.link}>Çıxış</Text></Pressable></View>
    <MobileWebView ref={web} source={{ uri: 'https://bid.cars/en/' }} onMessage={receive} javaScriptEnabled sharedCookiesEnabled thirdPartyCookiesEnabled setSupportMultipleWindows={false}
      onShouldStartLoadWithRequest={(request: WebViewNavigation) => { try { const host = new URL(request.url).hostname; return host === 'bid.cars' || host.endsWith('.bid.cars'); } catch { return false; } }} style={styles.web} />
    <View style={styles.sheet}>
      <View style={styles.row}><Text style={styles.sheetTitle}>{lot?.title || 'BidCars lot səhifəsini açın'}</Text><Pressable onPress={readPage} style={styles.secondary}><Text style={styles.secondaryText}>↻ Oxu</Text></Pressable></View>
      {lot ? <Text numberOfLines={2} style={styles.muted}>{[lot.auction, lot.location, money(lot.priceUsd)].filter(Boolean).join(' · ')}</Text> : null}
      {result ? <View style={styles.result}><View><Text style={styles.caption}>Auction fee</Text><Text style={styles.value}>{money(result.auctionFeeUsd)}</Text></View><View><Text style={styles.caption}>Yol</Text><Text style={styles.value}>{money(result.freightUsd)}</Text></View><View><Text style={styles.caption}>Gömrükdən əvvəl</Text><Text style={styles.value}>{money((result.invoiceUsd || result.priceUsd + result.auctionFeeUsd) + (result.freightUsd || 0))}</Text></View></View> : null}
      {error ? <Text style={styles.error}>{error}</Text> : null}
      <Pressable disabled={busy || !lot || account?.expired} onPress={calculate} style={[styles.primary, (!lot || account?.expired) && styles.disabled]}><Text style={styles.primaryText}>{busy ? 'Hesablanır…' : `${brand} ilə hesabla`}</Text></Pressable>
      <Text style={styles.note}>{account?.monthlyLimit == null ? 'Limitsiz paket' : `${account.remaining} / ${account.monthlyLimit} hesablama qalıb`} · Bu mobil test extension-dan müstəqildir.</Text>
    </View>
  </SafeAreaView>;
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#07111f' }, center: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#07111f' },
  login: { flex: 1, justifyContent: 'center', padding: 24, gap: 12 }, logo: { width: 52, height: 52, borderRadius: 15, backgroundColor: '#2563eb', alignItems: 'center', justifyContent: 'center' }, logoText: { color: 'white', fontSize: 28, fontWeight: '900' }, title: { color: 'white', fontSize: 28, fontWeight: '800' },
  header: { paddingHorizontal: 14, paddingVertical: 10, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: '#0b1728' }, brand: { color: 'white', fontSize: 17, fontWeight: '800' }, muted: { color: '#94a3b8', fontSize: 11, marginTop: 2 }, link: { color: '#7dd3fc', padding: 8 }, web: { flex: 1, backgroundColor: 'white' },
  sheet: { backgroundColor: '#0b1220', borderTopColor: '#26364d', borderTopWidth: 1, padding: 12, gap: 8 }, row: { flexDirection: 'row', gap: 8, alignItems: 'center', justifyContent: 'space-between' }, sheetTitle: { flex: 1, color: '#f8fafc', fontSize: 13, fontWeight: '700' },
  input: { borderColor: '#334155', borderWidth: 1, borderRadius: 12, backgroundColor: '#111827', color: 'white', paddingHorizontal: 14, paddingVertical: 13 }, primary: { borderRadius: 11, backgroundColor: '#16a34a', padding: 13, alignItems: 'center' }, primaryText: { color: 'white', fontSize: 14, fontWeight: '800' }, disabled: { opacity: 0.45 }, secondary: { borderColor: '#334155', borderWidth: 1, borderRadius: 9, paddingHorizontal: 11, paddingVertical: 7 }, secondaryText: { color: '#dbeafe', fontWeight: '700' },
  result: { flexDirection: 'row', justifyContent: 'space-between', gap: 8, backgroundColor: '#111b2d', borderRadius: 10, padding: 10 }, caption: { color: '#8294ad', fontSize: 9, textTransform: 'uppercase' }, value: { color: 'white', fontWeight: '800', fontSize: 12, marginTop: 3 }, error: { color: '#fca5a5', fontSize: 11 }, note: { color: '#64748b', fontSize: 10, textAlign: 'center' }
});
