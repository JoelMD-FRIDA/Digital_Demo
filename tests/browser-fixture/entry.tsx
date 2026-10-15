import {createRoot} from 'react-dom/client';
import {I18nProvider} from '../../src/lib/i18n';
import {Dashboard} from '../../src/components/dashboard';
import {SessionContinuity} from '../../src/components/session-continuity';
import RenewalComplete from '../../src/app/auth/renew/complete/page';
import '../../src/app/globals.css';
createRoot(document.getElementById('root')!).render(window.location.pathname==='/auth/renew/complete' ? <RenewalComplete/> :
  <I18nProvider initialLocale="en"><SessionContinuity/><Dashboard view="inbox"/></I18nProvider>);
