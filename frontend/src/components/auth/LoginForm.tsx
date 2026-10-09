'use client';

import React, { useState } from 'react';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import {
  Mail,
  AlertCircle,
  Loader2,
  Lock,
  Eye,
  EyeOff,
} from 'lucide-react';

import { useAuth } from '../../contexts/AuthContext';
import { useTranslation } from '../../hooks/useTranslation';

export default function LoginForm() {
  const router = useRouter();

  const t = useTranslation();
  const { login } = useAuth();

  const [formData, setFormData] = useState({
    email: '',
    password: '',
  });

  const [errors, setErrors] =
    useState<Record<string, string>>({});

  const [isLoading, setIsLoading] =
    useState(false);

  const [generalError, setGeneralError] =
    useState('');

  const [showPassword, setShowPassword] =
    useState(false);

  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (!formData.email.trim()) {
      newErrors.email = t.emailRequired;
    }

    if (!formData.password) {
      newErrors.password = t.passwordRequired;
    }

    setErrors(newErrors);

    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (
    e: React.FormEvent<HTMLFormElement>
  ) => {
    e.preventDefault();

    setGeneralError('');

    if (!validateForm()) {
      return;
    }

    setIsLoading(true);

    try {
      const result = await login(
        formData.email.trim(),
        formData.password.trim()
      );

      if (result.success) {
        router.replace('/');
        return;
      }

      setGeneralError(
        result.error || t.loginFailed
      );
    } catch {
      setGeneralError(t.unexpectedError);
    } finally {
      setIsLoading(false);
    }
  };

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement>
  ) => {
    const { name, value } = e.target;

    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));

    if (errors[name]) {
      setErrors((prev) => ({
        ...prev,
        [name]: '',
      }));
    }

    if (generalError) {
      setGeneralError('');
    }
  };

  return (
    <div
      className="
        min-h-screen
        flex
        items-center
        justify-center
        bg-gradient-to-br
        from-blue-50
        to-indigo-100
        dark:from-gray-900
        dark:to-gray-800
        p-4
      "
    >
      <div className="w-full max-w-5xl">
        <div
          className="
            bg-white
            dark:bg-gray-800
            rounded-xl
            shadow-2xl
            overflow-hidden
            lg:h-[600px]
          "
        >
          <div className="grid lg:grid-cols-2 h-full">

            {/* LEFT SIDE */}
            <div className="hidden lg:block relative h-full">
              <Image
                src="/images/portFunchal.png"
                alt="Port of Funchal"
                fill
                className="object-cover opacity-90"
                priority
              />

              <div
                className="
                  absolute
                  inset-0
                  bg-blue-900/40
                  flex
                  flex-col
                  justify-end
                  p-6
                "
              >
                <div className="text-white">
                  <h1 className="text-3xl font-bold mb-1">
                    {t.portOfFunchal}
                  </h1>

                  <p className="text-lg text-blue-100 mb-3">
                    {t.digitalTwinPlatform}
                  </p>

                  <p className="text-sm text-blue-200 leading-relaxed">
                    {t.advancedPortManagement}
                  </p>
                </div>
              </div>
            </div>

            {/* RIGHT SIDE */}
            <div
              className="
                p-6
                lg:p-8
                flex
                flex-col
                justify-center
              "
            >
              <div className="w-full translate-y-4">

                {/* HEADER */}
                <div className="text-center mb-7">
                  <div className="flex justify-center mb-4">
                    <Image
                      src="/images/shift2dc_logo.png"
                      alt="Shift2DC"
                      width={180}
                      height={56}
                      className="h-auto w-auto"
                      priority
                    />
                  </div>

                  <h2
                    className="
                      text-2xl
                      font-bold
                      text-gray-900
                      dark:text-gray-100
                    "
                  >
                    {t.welcomeBack}
                  </h2>

                  <p
                    className="
                      mt-1
                      text-sm
                      text-gray-600
                      dark:text-gray-400
                    "
                  >
                    {t.accessRestricted}
                  </p>
                </div>

                {/* FORM */}
                <form
                  onSubmit={handleSubmit}
                  className="space-y-3"
                >

                  {/* USERNAME */}
                  <div>
                    <label
                      htmlFor="email"
                      className="
                        block
                        text-sm
                        font-medium
                        text-gray-700
                        dark:text-gray-300
                        mb-1.5
                      "
                    >
                      {t.emailAddress}
                    </label>

                    <div className="relative">
                      <div
                        className="
                          absolute
                          inset-y-0
                          left-0
                          pl-3
                          flex
                          items-center
                          pointer-events-none
                        "
                      >
                        <Mail className="h-5 w-5 text-gray-400" />
                      </div>

                      <input
                        id="email"
                        name="email"
                        type="text"
                        value={formData.email}
                        onChange={handleChange}
                        disabled={isLoading}
                        placeholder="Username or email"
                        className={`
                          block
                          w-full
                          pl-10
                          pr-3
                          py-2.5
                          border
                          rounded-md
                          shadow-sm
                          placeholder-gray-400
                          focus:outline-none
                          focus:ring-2
                          focus:ring-blue-500
                          focus:border-blue-500
                          text-gray-900
                          dark:text-gray-100
                          ${
                            errors.email
                              ? `
                                border-red-300
                                dark:border-red-600
                                bg-red-50
                                dark:bg-red-900/20
                              `
                              : `
                                border-gray-300
                                dark:border-gray-600
                                bg-white
                                dark:bg-gray-700
                              `
                          }
                        `}
                      />
                    </div>

                    <div className="h-4 mt-1">
                      {errors.email && (
                        <p
                          className="
                            text-xs
                            leading-4
                            text-red-600
                            dark:text-red-400
                          "
                        >
                          {errors.email}
                        </p>
                      )}
                    </div>
                  </div>

                  {/* PASSWORD */}
                  <div>
                    <label
                      htmlFor="password"
                      className="
                        block
                        text-sm
                        font-medium
                        text-gray-700
                        dark:text-gray-300
                        mb-1.5
                      "
                    >
                      {t.password}
                    </label>

                    <div className="relative">
                      <div
                        className="
                          absolute
                          inset-y-0
                          left-0
                          pl-3
                          flex
                          items-center
                          pointer-events-none
                        "
                      >
                        <Lock className="h-5 w-5 text-gray-400" />
                      </div>

                      <input
                        id="password"
                        name="password"
                        type={
                          showPassword
                            ? 'text'
                            : 'password'
                        }
                        value={formData.password}
                        onChange={handleChange}
                        disabled={isLoading}
                        placeholder={t.enterYourPassword}
                        className={`
                          block
                          w-full
                          pl-10
                          pr-10
                          py-2.5
                          border
                          rounded-md
                          shadow-sm
                          placeholder-gray-400
                          focus:outline-none
                          focus:ring-2
                          focus:ring-blue-500
                          focus:border-blue-500
                          text-gray-900
                          dark:text-gray-100
                          ${
                            errors.password
                              ? `
                                border-red-300
                                dark:border-red-600
                                bg-red-50
                                dark:bg-red-900/20
                              `
                              : `
                                border-gray-300
                                dark:border-gray-600
                                bg-white
                                dark:bg-gray-700
                              `
                          }
                        `}
                      />

                      <button
                        type="button"
                        onClick={() =>
                          setShowPassword(
                            (value) => !value
                          )
                        }
                        disabled={isLoading}
                        aria-label={
                          showPassword
                            ? 'Hide password'
                            : 'Show password'
                        }
                        className="
                          absolute
                          inset-y-0
                          right-0
                          pr-3
                          flex
                          items-center
                        "
                      >
                        {showPassword ? (
                          <EyeOff
                            className="
                              h-5
                              w-5
                              text-gray-400
                              hover:text-gray-600
                              dark:hover:text-gray-300
                            "
                          />
                        ) : (
                          <Eye
                            className="
                              h-5
                              w-5
                              text-gray-400
                              hover:text-gray-600
                              dark:hover:text-gray-300
                            "
                          />
                        )}
                      </button>
                    </div>

                    <div className="h-4 mt-1">
                      {errors.password && (
                        <p
                          className="
                            text-xs
                            leading-4
                            text-red-600
                            dark:text-red-400
                          "
                        >
                          {errors.password}
                        </p>
                      )}
                    </div>
                  </div>

                  {/* LOGIN ERROR */}
                  <div className="h-[46px]">
                    {generalError && (
                      <div
                        className="
                          h-full
                          bg-red-50
                          dark:bg-red-900/20
                          border
                          border-red-200
                          dark:border-red-800
                          rounded-md
                          px-3
                          flex
                          items-center
                        "
                      >
                        <AlertCircle
                          className="
                            h-4
                            w-4
                            text-red-500
                            flex-shrink-0
                          "
                        />

                        <p
                          className="
                            ml-2
                            text-xs
                            leading-4
                            text-red-800
                            dark:text-red-200
                          "
                        >
                          {generalError}
                        </p>
                      </div>
                    )}
                  </div>

                  {/* SIGN IN */}
                  <button
                    type="submit"
                    disabled={isLoading}
                    className="
                      w-full
                      flex
                      justify-center
                      items-center
                      py-2.5
                      px-4
                      border
                      border-transparent
                      rounded-md
                      shadow-sm
                      text-sm
                      font-medium
                      text-white
                      bg-blue-600
                      hover:bg-blue-700
                      focus:outline-none
                      focus:ring-2
                      focus:ring-offset-2
                      focus:ring-blue-500
                      disabled:opacity-50
                      disabled:cursor-not-allowed
                      dark:bg-blue-500
                      dark:hover:bg-blue-600
                      transition-colors
                    "
                  >
                    {isLoading ? (
                      <>
                        <Loader2 className="animate-spin -ml-1 mr-2 h-4 w-4" />
                        {t.signingIn}
                      </>
                    ) : (
                      t.signIn
                    )}
                  </button>
                </form>

                {/* FOOTER */}
                <div className="text-center mt-5">
                  <p
                    className="
                      text-xs
                      leading-4
                      text-gray-500
                      dark:text-gray-400
                    "
                  >
                    {t.onlyAuthorizedStaff}
                    <br />
                    {t.contactITSupport}
                  </p>
                </div>
              </div>

              {/* MOBILE IMAGE */}
              <div className="lg:hidden mt-6">
                <div className="relative h-36 rounded-lg overflow-hidden">
                  <Image
                    src="/images/portFunchal.png"
                    alt="Port of Funchal"
                    fill
                    className="object-cover"
                  />
                </div>
              </div>
            </div>

          </div>
        </div>
      </div>
    </div>
  );
}