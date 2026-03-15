import { useState } from 'react';
import { useNavigate } from 'react-router';
import toast from 'react-hot-toast';
import api from '../../lib/api';
import { useAuthStore } from '../../store/authStore';
import { Button } from '../components/ui/button';
import { Card } from '../components/ui/card';
import { InputOTP, InputOTPGroup, InputOTPSlot } from '../components/ui/input-otp';
import { Shield, ArrowLeft } from 'lucide-react';

export default function Verify2FA() {
  const navigate = useNavigate();
  const login = useAuthStore((state) => state.login);
  const [code, setCode] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const devCode = sessionStorage.getItem('dev_code');

  const handleVerify = async () => {
    if (code.length !== 6) {
      toast.error('Please enter a 6-digit code');
      return;
    }

    setIsLoading(true);
    try {
      const temp_token = sessionStorage.getItem('temp_token');
      if (!temp_token || temp_token === 'undefined' || temp_token === 'null') {
        toast.error('2FA token missing. Please login again.');
        navigate('/admin/login');
        return;
      }

      const response = await api.post('/admin/auth/verify-2fa', { temp_token, code });
      
      if (response.data.success) {
        const { token: accessToken, admin } = response.data.data;
        sessionStorage.removeItem('dev_code');
        login(accessToken, admin);
        toast.success('Welcome back!');
        navigate('/admin');
      }
    } catch (error) {
      toast.error('Invalid verification code');
      setCode('');
    } finally {
      setIsLoading(false);
    }
  };

  const handleBack = () => {
    sessionStorage.removeItem('temp_token');
    navigate('/admin/login');
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100 px-4">
      <Card className="w-full max-w-md p-8 bg-white rounded-xl shadow-lg">
        <div className="flex flex-col items-center mb-8">
          <div className="bg-blue-600 p-3 rounded-full mb-4">
            <Shield className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-2xl font-bold text-gray-900">Two-Factor Authentication</h1>
          <p className="text-gray-500 mt-2 text-center">
            Enter the 6-digit code from your authenticator app
          </p>
        </div>

        <div className="space-y-6">
          <div className="flex justify-center">
            <InputOTP
              maxLength={6}
              value={code}
              onChange={setCode}
              onComplete={handleVerify}
            >
              <InputOTPGroup>
                <InputOTPSlot index={0} />
                <InputOTPSlot index={1} />
                <InputOTPSlot index={2} />
                <InputOTPSlot index={3} />
                <InputOTPSlot index={4} />
                <InputOTPSlot index={5} />
              </InputOTPGroup>
            </InputOTP>
          </div>

          {devCode && (
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <p className="text-sm text-blue-800">
                <strong>Development Hint:</strong> Use code{' '}
                <code className="bg-blue-100 px-2 py-1 rounded">{devCode}</code> for testing
              </p>
            </div>
          )}

          <Button
            onClick={handleVerify}
            className="w-full"
            disabled={isLoading || code.length !== 6}
          >
            {isLoading ? 'Verifying...' : 'Verify'}
          </Button>

          <Button
            variant="ghost"
            onClick={handleBack}
            className="w-full"
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Login
          </Button>
        </div>
      </Card>
    </div>
  );
}
