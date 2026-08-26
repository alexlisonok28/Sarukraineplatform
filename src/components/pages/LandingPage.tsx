import { PageType } from '../../App';
import { Trophy, Scale, Users, FileText, Medal, BarChart3, ArrowRight, Mail, MessageCircle } from 'lucide-react';

type LandingPageProps = {
  onPageChange: (page: PageType) => void;
  isLoggedIn: boolean;
};

export default function LandingPage({ onPageChange, isLoggedIn }: LandingPageProps) {
  const checkLoginForRating = () => {
    if (!isLoggedIn) {
      alert('Увійдіть, щоб переглянути рейтинг');
    } else {
      onPageChange('rating');
    }
  };

  return (
    <>
      <section className="py-[120px] px-6 md:py-[80px] text-center relative overflow-hidden">
        <div className="relative z-10">
          <h1 className="text-4xl md:text-6xl mb-6 text-gray-900 leading-tight font-semibold">
            Платформа SAR Ukraine
          </h1>

          <p className="text-lg md:text-xl text-gray-600 mb-10 max-w-[700px] mx-auto leading-relaxed">
            Єдина платформа для спортсменів пошуково-рятувальної кінологічної служби
          </p>

          <div className="flex gap-4 justify-center flex-wrap">
            {isLoggedIn ? (
              <button
                className="px-[70px] py-[16px] bg-[#007AFF] hover:bg-[#0066CC] text-white border-none rounded-xl cursor-pointer transition-all duration-300 flex items-center gap-[10px]"
                onClick={() => onPageChange('cabinet')}
              >
                Кабінет <ArrowRight className="w-4 h-4" />
              </button>
            ) : (
              <>
                <button
                  className="px-[70px] py-[16px] bg-[#007AFF] hover:bg-[#0066CC] text-white border-none rounded-xl cursor-pointer transition-all duration-300 flex items-center gap-[10px]"
                  onClick={() => onPageChange('login')}
                >
                  Вхід <ArrowRight className="w-4 h-4" />
                </button>
                <button
                  className="px-10 py-4 bg-white hover:bg-gray-50 text-gray-900 border-2 border-gray-300 hover:border-gray-400 rounded-xl cursor-pointer transition-all duration-300"
                  onClick={() => onPageChange('register')}
                >
                  Зареєструватися
                </button>
              </>
            )}
          </div>
        </div>
      </section>

      <section className="max-w-[1400px] mx-auto px-6 pb-[80px] grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 pt-[0px] pr-[24px] pl-[24px]">
        {[
          { Icon: Trophy, title: 'Змагання', desc: 'Переглядайте майбутні змагання та реєструйтеся онлайн', page: 'competitions' as PageType },
          { Icon: Scale, title: 'Судді', desc: 'База всіх сертифікованих суддів SAR в Україні', page: 'judges' as PageType },
          { Icon: Users, title: 'Команди', desc: 'Знайдіть команди з пошуково-рятувальної кінології', page: 'teams' as PageType },
          { Icon: FileText, title: 'Документи', desc: 'Положення, регламенти та інші важливі документи', page: 'documents' as PageType },
          { Icon: Medal, title: 'Результати', desc: 'Результати минулих змагань', page: 'results' as PageType },
          { Icon: BarChart3, title: 'Рейтинг', desc: 'Рейтинг спортсменів (для зареєстрованих)', page: 'rating' as PageType, special: true },
        ].map((feature, idx) => (
          <div
            key={idx}
            className="bg-white shadow-sm rounded-[20px] p-8 transition-all duration-[400ms] cursor-pointer relative overflow-hidden group hover:translate-y-[-8px] hover:shadow-xl"
            onClick={() => feature.special ? checkLoginForRating() : onPageChange(feature.page)}
          >
            <div className="absolute top-0 left-0 right-0 h-[3px] bg-[#007AFF] transform scale-x-0 origin-left transition-transform duration-400 group-hover:scale-x-100" />
            <div className="w-14 h-14 bg-gray-100 rounded-[14px] flex items-center justify-center mb-6 transition-all duration-300 group-hover:scale-110 group-hover:rotate-[5deg] group-hover:bg-[#007AFF]">
              <feature.Icon className="w-7 h-7 text-[#007AFF] group-hover:text-white" />
            </div>
            <h3 className="text-gray-900 mb-3 font-semibold text-[18px]">{feature.title}</h3>
            <p className="text-gray-600 leading-relaxed mb-6">{feature.desc}</p>
            <div className="flex items-center gap-2 text-[#007AFF] transition-all duration-300 group-hover:gap-3">
              Перейти <ArrowRight className="w-4 h-4" />
            </div>
          </div>
        ))}
      </section>

      <section className="max-w-[1100px] mx-auto px-6 pb-[80px] pt-[0px] pr-[24px] pl-[24px]">
        <div className="bg-white shadow-sm rounded-3xl p-12 md:p-[60px] relative overflow-hidden">
          <h2 className="text-4xl md:text-[40px] mb-7 text-center text-gray-900 relative font-semibold">Про SAR</h2>
          <p className="text-gray-600 leading-relaxed mb-5 text-center relative">Пошуково-рятувальна кінологічна служба (SAR) - це спеціалізована дисципліна, де собаки та їх провідники працюють разом для пошуку та рятування людей.</p>
          <p className="text-gray-600 leading-relaxed text-center relative">Ця платформа створена для об'єднання спортсменів SAR по всій Україні, надання доступу до актуальної інформації про змагання, суддів, команди та рейтинги. Зареєструйтеся, щоб отримати повний доступ до всіх функцій.</p>
        </div>
      </section>

      <section className="max-w-[1100px] mx-auto px-6 pb-[100px]">
        <div className="bg-white shadow-sm rounded-3xl p-12 text-center">
          <div className="flex items-center justify-center gap-2 mb-4">
            <MessageCircle className="w-6 h-6 text-gray-900" />
            <h3 className="text-gray-900 font-semibold text-[24px]">Технічна підтримка</h3>
          </div>
          <p className="text-gray-600 mb-6">Маєте питання щодо роботи платформи? Зв'яжіться з нами:</p>
          <a href="mailto:support@sar-ukraine.com" className="inline-flex items-center gap-3 px-7 py-[14px] bg-gray-100 hover:bg-gray-200 shadow-sm rounded-xl text-[#007AFF] no-underline transition-all duration-300">
            <Mail className="w-5 h-5" /> support@sar-ukraine.com
          </a>
        </div>
      </section>
    </>
  );
}